// backend/routes/returns.js
import express from "express";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import {
  // Returns
  getAllReturns,
  getReturnById,
  addReturn,
  updateReturn,
  deleteReturn,
  // Entities
  getCustomerById,
  getProductById,
  updateProductStock,
  getWarehouseById,
  // ל-UPSERT של פריטים ידניים
  addProduct,
} from "../firestoreService.js";

const router = express.Router();

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------- עזר: נירמול תאריך (כולל Firestore Timestamp) ------- */
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

async function hydrateItemsWithWarehouseName(items = []) {
  return Promise.all(
    (items || []).map(async (it) => {
      const wid = String(it?.warehouseId || "").trim();
      let wname = String(it?.warehouseName || "").trim();
      if (wid && !wname) wname = await resolveWarehouseNameById(wid);
      return { ...it, warehouseId: wid, warehouseName: wname };
    })
  );
}

/* =========================
 *          GETs
 * ========================= */

// GET /api/returns
router.get("/", async (_req, res) => {
  try {
    const rows = await getAllReturns();
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const wid = String(r?.warehouseId || "").trim();
        const wname = r?.warehouseName || (await resolveWarehouseNameById(wid));
        const items = await hydrateItemsWithWarehouseName(r.items || []);
        return { ...r, warehouseId: wid, warehouseName: String(wname || ""), items };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/returns/:id
router.get("/:id", async (req, res) => {
  try {
    const r = await getReturnById(req.params.id);
    const wid = String(r?.warehouseId || "").trim();
    const wname = r?.warehouseName || (await resolveWarehouseNameById(wid));
    const items = await hydrateItemsWithWarehouseName(r.items || []);
    res.json({ ...r, warehouseId: wid, warehouseName: String(wname || ""), items });
  } catch (err) {
    res.status(404).json({ error: "Return not found" });
  }
});

/* =========================
 *          POST
 * ========================= */

// POST /api/returns — יצירת זיכוי (הגדלת מלאי)
// תומך גם בפריטים ידניים: items[].{ product? | sku, name?, description? } + quantity
router.post("/", async (req, res) => {
  try {
    const {
      warehouseId = "",      // מחסן יעד: חובה כאשר יש פריטים ידניים (sku)
      customer,
      customerName,
      returnedBy,            // מי החזיר
      items,                 // [{ product? , sku?, name?, description?, quantity }]
      signature,             // dataURL (רשות)
      date,
      personalNumber,        // רשות
      notes = "",            // הערות
    } = req.body || {};

    if (!customer || !customerName || !returnedBy || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "שדות חובה חסרים" });
    }

    const cleanWarehouseId = String(warehouseId || "").trim();
    const hasManualItem = items.some((it) => !it?.product && it?.sku);
    if (hasManualItem && !cleanWarehouseId) {
      return res.status(400).json({ error: "עבור פריטים ידניים לפי SKU חובה לבחור מחסן יעד" });
    }

    const resolvedWarehouseName = await resolveWarehouseNameById(cleanWarehouseId);

    // ולידציית כמויות
    for (const row of items) {
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: "כמות חייבת להיות מספר חיובי" });
      }
    }

    // נרמול פריטים → תמיד עם product id
    const normalizedItems = [];
    for (const row of items) {
      const qty = Number(row.quantity);

      if (row.product) {
        // מוצר קיים
        const prod = await getProductById(String(row.product));
        if (!prod) return res.status(400).json({ error: `מוצר לא נמצא: ${String(row.product)}` });

        // בזיכוי — מגדילים מלאי במוצר עצמו
        await updateProductStock(String(row.product), +qty);

        normalizedItems.push({
          product: String(row.product),
          quantity: qty,
          warehouseId: cleanWarehouseId || String(row.warehouseId || prod.warehouseId || "").trim(),
          warehouseName:
            cleanWarehouseId
              ? resolvedWarehouseName
              : (String(row.warehouseName || "").trim() || String(prod.warehouseName || "")),
        });
      } else if (row.sku) {
        // פריט ידני — UPSERT לפי (SKU, מחסןיעד) דרך addProduct
        const cleanSku = String(row.sku || "").trim().toUpperCase();
        if (!cleanSku) return res.status(400).json({ error: "SKU ידני לא תקין" });

        const cleanName = String(row.name || "").trim() || cleanSku;
        const wid = cleanWarehouseId; // כבר אולץ כשיש ידני

        // addProduct אצלך מבצע UPSERT (אם קיים באותו מחסן → מגדיל מלאי; אחרת יוצר חדש)
        const upserted = await addProduct({
          name: cleanName,
          sku: cleanSku,
          description: String(row.description || "").trim(),
          stock: qty,           // הגדלת מלאי/יצירה עם הכמות הזו
          warehouseId: wid,
        });

        normalizedItems.push({
          product: String(upserted.id),
          quantity: qty,
          warehouseId: wid,
          warehouseName: upserted.warehouseName || resolvedWarehouseName || "",
        });
      } else {
        return res.status(400).json({ error: "כל פריט חייב להכיל product או sku" });
      }
    }

    // מי רשם זיכוי (מה־auth אם יש)
    const createdByUid = req.user?.uid || null;
    const createdByEmail = req.user?.email || null;
    const createdByName = req.user?.name || req.user?.displayName || null;

    const returnData = {
      warehouseId: cleanWarehouseId,
      warehouseName: resolvedWarehouseName || "",
      customer: String(customer),
      customerName: String(customerName),
      returnedBy: String(returnedBy),
      items: normalizedItems,
      signature: signature ? String(signature) : "",
      date: date ? new Date(date) : new Date(),
      personalNumber: personalNumber ? String(personalNumber) : "",
      notes: String(notes),
      createdByUid,
      createdByEmail,
      createdByName,
    };

    const created = await addReturn(returnData);
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/returns error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
 *      PDF “אישור זיכוי”
 * ========================= */

// POST /api/returns/:id/receipt
router.post("/:id/receipt", async (req, res) => {
  try {
    let signature = req.body?.signature;
    const data = await getReturnById(req.params.id);
    if (!data) return res.status(404).json({ error: "לא נמצא זיכוי" });
    if (!signature) signature = data.signature;

    // שם לקוח (fallback לפי מזהה)
    let customerName = data.customerName || "";
    if (!customerName && data.customer) {
      try {
        const customer = await getCustomerById(data.customer);
        customerName = customer ? customer.name : "";
      } catch {
        customerName = "";
      }
    }

    // שם מחסן יעד
    const wid = String(data.warehouseId || "").trim();
    let wname = String(data.warehouseName || "").trim();
    if (wid && !wname) {
      wname = await resolveWarehouseNameById(wid);
    }

    // פרטי מוצרים: name, sku, quantity
    const products = await Promise.all(
      (data.items || []).map(async (item) => {
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

    // כותרות תשובה
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=return_${req.params.id}.pdf`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.on("error", (e) => {
      try { if (!res.headersSent) res.status(500); res.end(); } catch {}
      console.error("PDF stream error:", e);
    });
    doc.pipe(res);

    // פונט עברית (אם קיים)
    try {
      const fontPath = path.resolve(__dirname, "../fonts/noto.ttf");
      doc.registerFont("hebrew", fontPath);
      doc.font("hebrew");
    } catch {}

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

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const { left, right, top, bottom } = doc.page.margins;
    const contentWidth = pageWidth - left - right;
    const tableRightX = pageWidth - right;

    // כותרת
    doc.fontSize(22);
    rtlText("אישור\u00A0זיכוי\u00A0מלאי");
    doc.moveDown(0.5);

    // פרטים כלליים
    doc.fontSize(14);
    rtlText(`לקוח: ${customerName || ""}`);
    rtlText(`הוחזר\u00A0על\u00A0ידי: ${data.returnedBy || ""}`);

    const byStr = data.createdByName || data.createdByEmail || data.createdByUid || "";
    if (byStr) rtlText(`נרשם\u00A0על\u00A0ידי: ${byStr}`);
    if (data.personalNumber) rtlText(`מספר\u00A0אישי: ${data.personalNumber}`);
    if (wname || wid) rtlText(`מחסן\u00A0יעד: ${wname || wid}`);

    const d = normalizeDate(data.date);
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

    if (data.notes) {
      doc.moveDown(0.5);
      rtlText(`הערות: ${data.notes}`);
    }

    doc.moveDown(1);

    // טבלה
    const qtyW = 70;
    const skuW = 120;
    const nameW = Math.max(120, contentWidth - qtyW - skuW);
    let y = doc.y + 6;
    const rowH = 24;

    const drawHeader = () => {
      doc.save();
      doc.fillColor("#f0f0f0");
      doc.rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH).fill();
      doc.restore();

      doc.lineWidth(0.5).strokeColor("#888")
        .rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH).stroke();

      doc.fontSize(12).fillColor("#000");
      doc.text("כמות", tableRightX - qtyW, y + 6, { width: qtyW - 6, align: "right" });
      rtlTextAt("שם\u00A0מוצר", tableRightX - qtyW, y + 6, nameW - 6);
      doc.text("מקט", tableRightX - (qtyW + nameW + skuW) + 6, y + 6, {
        width: skuW - 6,
        align: "right",
      });

      y += rowH;
    };

    const drawRow = (row) => {
      if (y + rowH > pageHeight - bottom) {
        doc.addPage();
        y = top;
        drawHeader();
      }

      doc.lineWidth(0.3).strokeColor("#ccc")
        .rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH).stroke();

      doc.fontSize(12).fillColor("#000");
      doc.text(String(row.quantity ?? ""), tableRightX - qtyW, y + 6, { width: qtyW - 6, align: "right" });
      rtlTextAt(String(row.name ?? ""), tableRightX - qtyW, y + 6, nameW - 6);
      doc.text(String(row.sku || "—"), tableRightX - (qtyW + nameW + skuW) + 6, y + 6, {
        width: skuW - 6,
        align: "right",
      });

      y += rowH;
    };

    drawHeader();
    if (!Array.isArray(products) || products.length === 0) {
      doc.lineWidth(0.3).strokeColor("#ccc")
        .rect(tableRightX - (skuW + nameW + qtyW), y, (skuW + nameW + qtyW), rowH).stroke();
      rtlTextAt("אין פריטים", tableRightX - qtyW, y + 6, nameW - 6);
      y += rowH;
    } else {
      products.forEach(drawRow);
    }

    y += 8;
    doc.moveDown(2);

    doc.fontSize(14);
    rtlText("חתימה של המַחזיר:");
    if (signature && typeof signature === "string" && signature.startsWith("data:image")) {
      try {
        const b64 = signature.replace(/^data:image\/\w+;base64,/, "");
        const sigBuffer = Buffer.from(b64, "base64");
        const imgWidth = 160;
        const x = pageWidth - right - imgWidth;
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
    console.error("Error generating Return PDF:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try { res.end(); } catch {}
    }
  }
});

/* =========================
 *     PUT / DELETE
 * ========================= */

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
          const wname = String(i?.warehouseName || "").trim() || (await resolveWarehouseNameById(wid));
          return { ...i, warehouseId: wid, warehouseName: wname };
        })
      );
    }

    const updated = await updateReturn(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteReturn(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

