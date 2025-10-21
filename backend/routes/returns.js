// backend/routes/returns.js
import express from "express";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import {
  getAllReturns,
  getReturnById,
  addReturn,
  updateReturn,
  deleteReturn,
  getCustomerById,
  getProductById,
  updateProductStock,
  getWarehouseById,
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

// POST /api/returns  — יצירת זיכוי (מעלה מלאי)
router.post("/", async (req, res) => {
  try {
    const {
      warehouseId = "",      // מחסן יעד (מומלץ)
      customer,
      customerName,
      returnedBy,            // מי החזיר
      items,                 // [{ product, quantity, (optional) warehouseId/Name }]
      signature,             // dataURL, רשות
      date,
      personalNumber,
      notes = "",
    } = req.body || {};

    if (!customer || !customerName || !returnedBy || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "שדות חובה חסרים" });
    }

    const cleanWarehouseId = String(warehouseId || "").trim();
    const resolvedWarehouseName = await resolveWarehouseNameById(cleanWarehouseId);

    // ולידציה בסיסית: קיום מוצרים + כמות חיובית
    for (const row of items) {
      if (!row?.product) return res.status(400).json({ error: "חסר מזהה מוצר בשורה" });
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: "כמות חייבת להיות מספר חיובי" });
      }
      const prod = await getProductById(String(row.product));
      if (!prod) return res.status(400).json({ error: `מוצר לא נמצא: ${String(row.product)}` });
    }

    // העלאת מלאי בפועל (+quantity)
    for (const row of items) {
      await updateProductStock(String(row.product), +Number(row.quantity));
    }

    // מי רשם זיכוי (אם יש אימות)
    const createdByUid = req.user?.uid || null;
    const createdByEmail = req.user?.email || null;
    const createdByName = req.user?.name || req.user?.displayName || null;

    // בניית items עם שם מחסן יעד
    const cleanItems = await Promise.all(
      items.map(async (i) => {
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

    const returnData = {
      warehouseId: cleanWarehouseId,
      warehouseName: resolvedWarehouseName || "",
      customer: String(customer),
      customerName: String(customerName),
      returnedBy: String(returnedBy),
      items: cleanItems,
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
    res.status(500).json({ error: err.message });
  }
});

/* =========================
 *      PDF “אישור זיכוי”
 * ========================= */

router.post("/:id/receipt", async (req, res) => {
  try {
    let signature = req.body?.signature;
    const data = await getReturnById(req.params.id);
    if (!data) return res.status(404).json({ error: "לא נמצא זיכוי" });
    if (!signature) signature = data.signature;

    // שם לקוח (fallback)
    let customerName = data.customerName || "";
    if (!customerName && data.customer) {
      try {
        const customer = await getCustomerById(data.customer);
        customerName = customer ? customer.name : "";
      } catch {
        customerName = "";
      }
    }

    // שם מחסן
    const wid = String(data.warehouseId || "").trim();
    let wname = String(data.warehouseName || "").trim();
    if (wid && !wname) {
      try {
        const wh = await getWarehouseById(wid);
        wname = String(wh?.name || "");
      } catch {}
    }

    // פרטי מוצרים
    let products = [];
    try {
      products = await Promise.all(
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
    } catch {
      products = [];
    }

    // כותרות תשובה
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=return_${req.params.id}.pdf`
    );

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

