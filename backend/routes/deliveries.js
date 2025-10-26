// backend/routes/deliveries.js
import express from "express";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import {
  getAllDeliveries,
  getDeliveryById,
  addDelivery,
  updateDelivery,
  deleteDelivery,
  getCustomerById,
  getProductById,
  updateProductStock,
  getWarehouseById,
} from "../firestoreService.js";

const router = express.Router();

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------- עזר: נירמול תאריך מכל פורמט (כולל Firestore Timestamp) ------- */
const normalizeDate = (x) => {
  try {
    if (!x) return null;
    const sec = x?.seconds ?? x?._seconds;
    const nsec = x?.nanoseconds ?? x?._nanoseconds ?? 0;
    if (typeof sec === "number") {
      return new Date(sec * 1000 + Math.floor(nsec / 1e6));
    }
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

/* ------- עזר: השלמת שם מחסן לפי מזהה (ריק אם לא נמצא) ------- */
async function resolveWarehouseNameById(wid) {
  const id = String(wid || "").trim();
  if (!id) return "";
  try {
    const wh = await getWarehouseById(id);
    return String(wh?.name || "");
  } catch {
    return "";
  }
}

/* ------- עזר: העשרת items בשם מחסן אם חסר ------- */
async function hydrateItemsWithWarehouseName(items = []) {
  return Promise.all(
    (items || []).map(async (it) => {
      const wid = String(it?.warehouseId || "").trim();
      let wname = String(it?.warehouseName || "").trim();
      if (wid && !wname) {
        wname = await resolveWarehouseNameById(wid);
      }
      return { ...it, warehouseId: wid, warehouseName: wname };
    })
  );
}

/* =======================================
 *               GETs
 * ======================================= */

// GET /api/deliveries
router.get("/", async (_req, res) => {
  try {
    const deliveries = await getAllDeliveries();
    const enriched = await Promise.all(
      deliveries.map(async (d) => {
        const wid = String(d?.warehouseId || "").trim();
        const wname = d?.warehouseName || (await resolveWarehouseNameById(wid));
        const items = await hydrateItemsWithWarehouseName(d.items || []);
        // manualItems לא נוגעים במחסן (הן ידניות)
        return { ...d, warehouseId: wid, warehouseName: String(wname || ""), items };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deliveries/:id
router.get("/:id", async (req, res) => {
  try {
    const d = await getDeliveryById(req.params.id);
    if (!d) return res.status(404).json({ error: "ניפוק לא נמצא" });
    const wid = String(d?.warehouseId || "").trim();
    const wname = d?.warehouseName || (await resolveWarehouseNameById(wid));
    const items = await hydrateItemsWithWarehouseName(d.items || []);
    res.json({ ...d, warehouseId: wid, warehouseName: String(wname || ""), items });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/* =======================================
 *            יצירת ניפוק
 * ======================================= */

// מיפוי אליאסים מהקליינט
function pickBody(reqBody = {}) {
  const b = reqBody || {};
  // אליאסים לשדות עליונים
  const deliveredTo =
    b.deliveredTo ?? b.delivered_to ?? "";
  const personalNumber =
    b.personalNumber ?? b.personal_number ?? "";
  const signature =
    b.signature ?? b.signatureData ?? "";
  const customer =
    b.customer ?? b.customerId ?? "";
  const customerName = b.customerName ?? "";

  // אליאסים לפריטים
  const itemsRaw = Array.isArray(b.items) ? b.items : [];
  const items = itemsRaw.map((row) => ({
    product: row.product ?? row.productId ?? "",
    quantity: Number(row.quantity ?? 0),
    // נרשה גם per-item שיוך מחסן (לא חובה)
    warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
    warehouseName: row.warehouseName ? String(row.warehouseName) : undefined,
  }));

  const manualItems = Array.isArray(b.manualItems)
    ? b.manualItems.map((m) => ({
        name: String(m.name || "").trim(),
        sku: String(m.sku || "").trim(),
        quantity: Number(m.quantity || 0),
      }))
    : [];

  const warehouseId = String(b.warehouseId || b.warehouse || "").trim();
  const date = b.date;

  return {
    warehouseId,
    customer,
    customerName,
    deliveredTo,
    items,
    manualItems,
    signature,
    date,
    personalNumber,
  };
}

// POST /api/deliveries
router.post("/", async (req, res) => {
  try {
    const {
      warehouseId,
      customer,
      customerName,
      deliveredTo,
      items = [],
      manualItems = [],
      signature,
      date,
      personalNumber,
    } = pickBody(req.body);

    // ולידציית חובה
    if (!customer || !customerName || !deliveredTo || !signature) {
      return res.status(400).json({ error: "שדות חובה חסרים" });
    }
    if ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(manualItems) || manualItems.length === 0)) {
      return res.status(400).json({ error: "אין פריטים לניפוק" });
    }

    const cleanWarehouseId = String(warehouseId || "").trim();
    const resolvedWarehouseName = await resolveWarehouseNameById(cleanWarehouseId);

    // ולידציה לפריטי קטלוג בלבד (מוצרים קיימים + מלאי מספיק)
    for (const row of items) {
      if (!row?.product) return res.status(400).json({ error: "חסר מזהה מוצר בשורה" });
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: "כמות חייבת להיות מספר חיובי" });
      }

      const prod = await getProductById(String(row.product));
      if (!prod) return res.status(400).json({ error: `מוצר לא נמצא: ${String(row.product)}` });

      if (cleanWarehouseId && String(prod.warehouseId || "") !== cleanWarehouseId) {
        return res.status(400).json({ error: `המוצר "${prod.name}" לא משויך למחסן שנבחר` });
      }

      const stock = Number(prod.stock ?? 0);
      if (stock < qty) {
        return res.status(400).json({
          error: `אין מספיק מלאי עבור "${prod.name}". במלאי: ${stock}, ביקשת: ${qty}`,
        });
      }
    }

    // ולידציה לפריטים ידניים (שם + כמות חיובית)
    for (const mi of manualItems) {
      const q = Number(mi.quantity);
      if (!mi.name || !mi.name.trim()) {
        return res.status(400).json({ error: "בפריט ידני יש למלא 'שם פריט'." });
      }
      if (!Number.isFinite(q) || q < 1) {
        return res.status(400).json({ error: "כמות בפריט ידני חייבת להיות מספר חיובי" });
      }
    }

    // הפחתת מלאי — רק לפריטי קטלוג
    for (const row of items) {
      await updateProductStock(String(row.product), -Number(row.quantity));
    }

    // מי ניפק? (אם יש אימות)
    const issuedByUid = req.user?.uid || null;
    const issuedByEmail = req.user?.email || null;
    const issuedByName = req.user?.name || req.user?.displayName || null;

    // בניית items עם שם מחסן (אם יש)
    const cleanItems = await Promise.all(
      (items || []).map(async (i) => {
        const wid = cleanWarehouseId || String(i.warehouseId || "").trim();
        const wname =
          cleanWarehouseId
            ? resolvedWarehouseName
            : (String(i.warehouseName || "").trim() || (await resolveWarehouseNameById(wid)));
        return {
          product: String(i.product),
          quantity: Number(i.quantity),
          warehouseId: wid,
          warehouseName: wname,
        };
      })
    );

    // פריטים ידניים נשמרים כפי שהם (אין שינוי מלאי)
    const cleanManuals = (manualItems || []).map((m) => ({
      name: String(m.name || "").trim(),
      sku: String(m.sku || "").trim(),
      quantity: Number(m.quantity || 0),
    }));

    const deliveryData = {
      warehouseId: cleanWarehouseId,
      warehouseName: resolvedWarehouseName || "",
      customer: String(customer),
      customerName: String(customerName),
      deliveredTo: String(deliveredTo),
      items: cleanItems,              // פריטי קטלוג
      manualItems: cleanManuals,      // פריטים ידניים
      signature: String(signature),
      date: date ? new Date(date) : new Date(),
      personalNumber: personalNumber ? String(personalNumber) : "",
      issuedByUid,
      issuedByEmail,
      issuedByName,
    };

    const newDelivery = await addDelivery(deliveryData);
    res.status(201).json(newDelivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================================
 *      קבלה PDF — הזרמה ישירה (Streaming)
 * ======================================= */

router.post("/:id/receipt", async (req, res) => {
  try {
    let signature = req.body?.signature ?? req.body?.signatureData;
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "לא נמצא ניפוק" });
    if (!signature) signature = delivery.signature;

    // שם לקוח (fallback)
    let customerName = delivery.customerName || "";
    if (!customerName && delivery.customer) {
      try {
        const customer = await getCustomerById(delivery.customer);
        customerName = customer ? customer.name : "";
      } catch {
        customerName = "";
      }
    }

    // שם מחסן
    const wid = String(delivery.warehouseId || "").trim();
    let wname = String(delivery.warehouseName || "").trim();
    if (wid && !wname) {
      wname = await resolveWarehouseNameById(wid);
    }

    // פרטי מוצרים: גם קטלוגיים וגם ידניים
    let products = [];
    try {
      const catalog = await Promise.all(
        (delivery.items || []).map(async (item) => {
          try {
            const prod = await getProductById(item.product);
            return {
              name: prod?.name || "מוצר לא ידוע",
              sku: prod?.sku || "",
              quantity: item.quantity,
            };
          } catch {
            return { name: "מוצר לא ידוע", sku: "", quantity: item.quantity };
          }
        })
      );

      const manuals = (delivery.manualItems || []).map((m) => ({
        name: m.name || "פריט ידני",
        sku: m.sku || "",
        quantity: m.quantity,
      }));

      products = [...catalog, ...manuals];
    } catch {
      products = [];
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=receipt_${req.params.id}.pdf`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.on("error", (e) => {
      if (!res.headersSent) res.status(500);
      try { res.end(); } catch {}
      console.error("PDF stream error:", e);
    });
    doc.pipe(res);

    // פונט עברית (אם קיים)
    try {
      const fontPath = path.resolve(__dirname, "../fonts/noto.ttf");
      doc.registerFont("hebrew", fontPath);
      doc.font("hebrew");
    } catch {}

    // RTL helpers
    const rtlText = (text, options = {}) => {
      const rtlMark = "\u200F";
      const str = (text ?? "").toString().replace(/\s+/g, " ").trim();
      const fixed = str.length === 0 ? "" : rtlMark + str.split(" ").reverse().join(" ");
      doc.text(fixed, { align: "right", ...options });
    };
    const rtlTextAt = (text, xRight, y, width) => {
      doc.text("", xRight - width, y);
      rtlText(text, { width, align: "right" });
    };

    // פרמטרי עמוד
    const pageWidth = doc.page.width;
    const { right, top, bottom } = doc.page.margins;
    const contentWidth = pageWidth - doc.page.margins.left - right;
    const tableRightX = pageWidth - right;

    // כותרת
    doc.fontSize(22);
    rtlText("קבלה\u00A0על ניפוק מלאי");
    doc.moveDown(0.5);

    // פרטים כלליים
    doc.fontSize(14);
    rtlText(`לקוח: ${customerName || ""}`);
    rtlText(`נופק\u00A0ל: ${delivery.deliveredTo || ""}`);

    const byStr = delivery.issuedByName || delivery.issuedByEmail || delivery.issuedByUid || "";
    if (byStr) rtlText(`נופק\u00A0על\u00A0ידי: ${byStr}`);
    if (delivery.personalNumber) rtlText(`מספר\u00A0אישי: ${delivery.personalNumber}`);
    if (wname || wid) rtlText(`מחסן\u00A0מקור: ${wname || wid}`);

    const d = normalizeDate(delivery.date);
    const dateText = d
      ? d.toLocaleString("he-IL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jerusalem",
        })
      : "";
    rtlText(`תאריך: ${dateText}`);
    doc.moveDown(1);

    // טבלת מוצרים
    const skuW = 120;
    const qtyW = 70;
    const nameW = Math.max(120, contentWidth - skuW - qtyW);

    let y = doc.y + 6;
    const rowH = 24;

    const drawHeader = () => {
      doc.save();
      doc.fillColor("#f0f0f0");
      doc.rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH).fill();
      doc.restore();

      doc.lineWidth(0.5).strokeColor("#888")
        .rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH)
        .stroke();

      doc.fontSize(12).fillColor("#000");
      doc.text("מקט", tableRightX - skuW, y + 6, { width: skuW - 6, align: "right" });
      rtlTextAt("שם\u00A0מוצר", tableRightX - skuW, y + 6, nameW - 6);
      doc.text("כמות", tableRightX - (skuW + nameW + qtyW) + 6, y + 6, { width: qtyW - 6, align: "right" });

      y += rowH;
    };

    const maybeNewPage = () => {
      if (y + rowH > doc.page.height - bottom) {
        doc.addPage();
        y = top;
        drawHeader();
      }
    };

    drawHeader();
    if (!Array.isArray(products) || products.length === 0) {
      doc.lineWidth(0.3).strokeColor("#ccc")
        .rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH)
        .stroke();
      rtlTextAt("לא נבחרו מוצרים", tableRightX - skuW, y + 6, nameW - 6);
      y += rowH;
    } else {
      for (const row of products) {
        maybeNewPage();
        doc.lineWidth(0.3).strokeColor("#ccc")
          .rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH)
          .stroke();

        doc.fontSize(12).fillColor("#000");
        doc.text(String(row.sku || "—"), tableRightX - skuW, y + 6, { width: skuW - 6, align: "right" });
        rtlTextAt(String(row.name ?? ""), tableRightX - skuW, y + 6, nameW - 6);
        doc.text(String(row.quantity ?? ""), tableRightX - (skuW + nameW + qtyW) + 6, y + 6, { width: qtyW - 6, align: "right" });

        y += rowH;
      }
    }

    y += 8;
    doc.moveDown(2);

    doc.fontSize(14);
    rtlText("חתימה:");
    const sig = signature && typeof signature === "string" ? signature : "";
    if (sig.startsWith("data:image")) {
      try {
        const b64 = sig.replace(/^data:image\/\w+;base64,/, "");
        const sigBuffer = Buffer.from(b64, "base64");
        const imgWidth = 160;
        const x = pageWidth - doc.page.margins.right - imgWidth;
        const yImg = doc.y + 6;
        doc.image(sigBuffer, x, yImg, { width: imgWidth });
        doc.moveDown(4);
      } catch {
        rtlText("— שגיאה בקריאת החתימה —");
        doc.moveDown(2);
      }
    } else {
      rtlText("__________________");
      doc.moveDown(2);
    }

    doc.end();
  } catch (err) {
    console.error("Error generating PDF receipt:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try { res.end(); } catch {}
    }
  }
});

/* =======================================
 *        עדכון ומחיקה של ניפוק
 * ======================================= */

router.put("/:id", async (req, res) => {
  try {
    const updates = { ...(req.body || {}) };

    if (updates.warehouseId !== undefined) {
      const wid = String(updates.warehouseId || "").trim();
      updates.warehouseId = wid;
      updates.warehouseName = updates.warehouseName ?? (await resolveWarehouseNameById(wid));
    }

    if (Array.isArray(updates.items)) {
      updates.items = await Promise.all(
        updates.items.map(async (i) => {
          const wid = String(i?.warehouseId || updates.warehouseId || "").trim();
          const wname =
            String(i?.warehouseName || "").trim() ||
            (await resolveWarehouseNameById(wid));
          return { ...i, warehouseId: wid, warehouseName: wname };
        })
      );
    }

    const updated = await updateDelivery(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: "ניפוק לא נמצא" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteDelivery(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
