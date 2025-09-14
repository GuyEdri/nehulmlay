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

/* =======================================
 *               GETs
 * ======================================= */

// GET /api/deliveries  (מחזיר את כל הניפוקים; פרמטר product אופציונלי, נסנן בצד לקוח)
router.get("/", async (req, res) => {
  try {
    const deliveries = await getAllDeliveries();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deliveries/:id
router.get("/:id", async (req, res) => {
  try {
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "ניפוק לא נמצא" });
    res.json(delivery);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/* =======================================
 *            יצירת ניפוק
 * ======================================= */

// POST /api/deliveries
// תומך ב־warehouseId: יוודא שכל המוצרים בניפוק שייכים למחסן זה ושהמלאי מספיק — ואז יפחית מהמלאי.
router.post("/", async (req, res) => {
  try {
    const {
      warehouseId = "",        // 👈 מחסן מקור (רשות; אם ריק – אין אילוץ שייכות)
      customer,
      customerName,
      deliveredTo,
      items,
      signature,
      date,
      personalNumber,
    } = req.body;

    if (!customer || !customerName || !deliveredTo || !Array.isArray(items) || items.length === 0 || !signature) {
      return res.status(400).json({ error: "שדות חובה חסרים" });
    }

    //וולידציה: מוצרים קיימים, כמות חוקית, ואם נבחר מחסן — המוצר שייך אליו
    for (const row of items) {
      if (!row?.product) return res.status(400).json({ error: "חסר מזהה מוצר בשורה" });
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: "כמות חייבת להיות מספר חיובי" });
      }

      const prod = await getProductById(String(row.product));
      if (!prod) return res.status(400).json({ error: `מוצר לא נמצא: ${String(row.product)}` });

      if (warehouseId && String(prod.warehouseId || "") !== String(warehouseId)) {
        return res.status(400).json({ error: `המוצר "${prod.name}" לא משויך למחסן שנבחר` });
      }

      const stock = Number(prod.stock ?? 0);
      if (stock < qty) {
        return res.status(400).json({
          error: `אין מספיק מלאי עבור "${prod.name}". במלאי: ${stock}, ביקשת: ${qty}`,
        });
      }
    }

    // עדכון מלאי בפועל (הפחתה)
    for (const row of items) {
      await updateProductStock(String(row.product), -Number(row.quantity));
    }

    // מי ניפק? (דורש verifyAuth ב-server.js עבור /api/deliveries)
    const issuedByUid = req.user?.uid || null;
    const issuedByEmail = req.user?.email || null;
    const issuedByName = req.user?.name || req.user?.displayName || null;

    const cleanItems = items.map((i) => ({
      product: String(i.product),
      quantity: Number(i.quantity),
    }));

    const deliveryData = {
      warehouseId: String(warehouseId || ""), // 👈 נשמר בניפוק
      customer: String(customer),
      customerName: String(customerName),
      deliveredTo: String(deliveredTo),
      items: cleanItems,
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

// POST /api/deliveries/:id/receipt
router.post("/:id/receipt", async (req, res) => {
  try {
    let signature = req.body?.signature;
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "לא נמצא ניפוק" });
    if (!signature) signature = delivery.signature;

    // שם לקוח (אם יש רק מזהה — ננסה להביא)
    let customerName = delivery.customerName || "";
    if (!customerName && delivery.customer) {
      try {
        const customer = await getCustomerById(delivery.customer);
        customerName = customer ? customer.name : "";
      } catch {
        customerName = "";
      }
    }

    // פרטי מוצרים: name, sku, quantity
    let products = [];
    try {
      products = await Promise.all(
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
    } catch {
      products = [];
    }

    // כותרות תשובה לפני הזרמה
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt_${req.params.id}.pdf`
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    // טיפול בשגיאת stream
    doc.on("error", (e) => {
      if (!res.headersSent) res.status(500);
      try { res.end(); } catch {}
      console.error("PDF stream error:", e);
    });

    // הזרמה ישירה ל־response
    doc.pipe(res);

    // ניסיון להטעין פונט עברית (אופציונלי)
    try {
      const fontPath = path.resolve(__dirname, "../fonts/noto.ttf");
      doc.registerFont("hebrew", fontPath);
      doc.font("hebrew");
    } catch {
      // אם אין פונט — ממשיכים עם ברירת מחדל
    }

    // עזרי RTL
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
    const pageHeight = doc.page.height;
    const { left, right, top, bottom } = doc.page.margins;
    const contentWidth = pageWidth - left - right;
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
    if (delivery.warehouseId) rtlText(`מחסן\u00A0מקור (ID): ${delivery.warehouseId}`);

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

    // ----- טבלת מוצרים: [מקט | שם מוצר | כמות] -----
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
      rtlTextAt("לא נבחרו מוצרים", tableRightX - qtyW, y + 6, nameW - 6);
      y += rowH;
    } else {
      products.forEach(drawRow);
    }

    y += 8;
    doc.moveTo(left, y);
    doc.moveDown(2);

    doc.fontSize(14);
    rtlText("חתימה:");
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

    // סגירה והזרמה
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

// PUT /api/deliveries/:id
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    const updated = await updateDelivery(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: "ניפוק לא נמצא" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/deliveries/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteDelivery(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

