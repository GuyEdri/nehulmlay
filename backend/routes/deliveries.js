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

// ---- עזר: נירמול תאריך מכל פורמט ----
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

/**
 * ---- עזר: הדפסת טקסט עברי תקין ל-PDFKit ----
 * PDFKit לא תומך RTL, אז:
 * 1) מנקים רווחים מיותרים.
 * 2) הופכים את סדר המילים כדי שיראו RTL.
 * 3) מוסיפים סימון RTL בתחילת השורה.
 * הערה: מסייע מאוד לטקסט עברי פשוט, כולל ערכים מעורבים (מספרים/אנגלית),
 * ועדיף עשרות מונים על טקסט “צמוד”/הפוך.
 */
const rtlText = (doc, text, options = {}) => {
  const rtlMark = "\u200F";
  const str = (text ?? "").toString().replace(/\s+/g, " ").trim();
  const fixed =
    str.length === 0 ? "" : rtlMark + str.split(" ").reverse().join(" ");
  doc.text(fixed, { align: "right", ...options });
};

// GET /api/deliveries?product=productId
router.get("/", async (req, res) => {
  try {
    const productId = req.query.product || null;
    const deliveries = await getAllDeliveries(productId);
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deliveries/:id
router.get("/:id", async (req, res) => {
  try {
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "ניפוק לא נמצא" });
    }
    res.json(delivery);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/deliveries
router.post("/", async (req, res) => {
  try {
    const { customer, customerName, deliveredTo, items, signature, date } = req.body;

    // שים לב: בגלל חתימה ב-base64 צריך להגדיל את limit ב-server.js:
    // app.use(express.json({ limit: '5mb' }));

    if (
      !customer ||
      !customerName ||
      !deliveredTo ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !signature
    ) {
      return res.status(400).json({ error: "שדות חובה חסרים" });
    }

    // ולידציה לכמויות ומזהי מוצרים
    for (const row of items) {
      if (!row?.product) {
        return res.status(400).json({ error: "חסר מזהה מוצר בשורה" });
      }
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: "כמות חייבת להיות מספר חיובי בשורה" });
      }
    }

    // 1) בדיקת מלאי לכל המוצרים
    for (const row of items) {
      const prod = await getProductById(String(row.product));
      if (!prod) {
        return res.status(400).json({ error: `מוצר לא נמצא: ${String(row.product)}` });
      }
      const qty = Number(row.quantity);
      const stock = Number(prod.stock ?? 0);
      if (stock < qty) {
        return res.status(400).json({
          error: `אין מספיק מלאי עבור "${prod.name}". במלאי: ${stock}, ביקשת: ${qty}`,
        });
      }
    }

    // 2) עדכון מלאי בפועל (רצוי בעסקה אם יש מרוצים)
    for (const row of items) {
      await updateProductStock(String(row.product), -Number(row.quantity));
    }

    // 3) שמירת ניפוק
    const cleanItems = items.map((i) => ({
      product: String(i.product),
      quantity: Number(i.quantity),
    }));

    const deliveryData = {
      customer: String(customer),
      customerName: String(customerName),
      deliveredTo: String(deliveredTo),
      items: cleanItems,
      signature: String(signature),
      date: date ? new Date(date) : new Date(),
    };

    const newDelivery = await addDelivery(deliveryData);
    res.status(201).json(newDelivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF RECEIPT - POST /api/deliveries/:id/receipt
router.post("/:id/receipt", async (req, res) => {
  try {
    // אם לא נשלחה חתימה בבקשה — נשתמש בזו ששמורה בניפוק
    let signature = req.body.signature;
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "לא נמצא ניפוק" });

    if (!signature) signature = delivery.signature;

    // שם לקוח
    let customerName = delivery.customerName || "";
    if (!customerName && delivery.customer) {
      try {
        const customer = await getCustomerById(delivery.customer);
        customerName = customer ? customer.name : "";
      } catch {
        customerName = "";
      }
    }

    // פרטי מוצרים
    let products = [];
    try {
      products = await Promise.all(
        (delivery.items || []).map(async (item) => {
          try {
            const prod = await getProductById(item.product);
            return { name: prod?.name || "מוצר לא ידוע", quantity: item.quantity };
          } catch {
            return { name: "מוצר לא ידוע", quantity: item.quantity };
          }
        })
      );
    } catch {
      products = [];
    }

    // פונט עברי
    const fontPath = path.resolve(__dirname, "../fonts/noto.ttf"); // ודא שהנתיב קיים
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    try {
      doc.registerFont("hebrew", fontPath);
      doc.font("hebrew");
    } catch {
      // אם אין פונט זמין, PDFKit ישתמש בברירת מחדל (ללא RTL תקין)
    }

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=receipt.pdf");
      res.send(pdfData);
    });

    // כותרת ופרטים כלליים
    doc.fontSize(22);
    rtlText(doc, "קבלה על ניפוק מלאי");
    doc.moveDown();

    doc.fontSize(16);
    rtlText(doc, `לקוח: ${customerName}`);
    rtlText(doc, `נופק למי: ${delivery.deliveredTo || ""}`);

    // תאריך — שימוש ב-normalizeDate + טיים־זון ישראל
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
    rtlText(doc, `תאריך: ${dateText}`);

    doc.moveDown();
    doc.fontSize(18);
    rtlText(doc, "מוצרים שנופקו:");

    doc.fontSize(15);
    if (!products.length) {
      rtlText(doc, "לא נבחרו מוצרים");
    } else {
      products.forEach((p, i) => {
        rtlText(doc, `${i + 1}. ${p.name} | כמות: ${p.quantity}`);
      });
    }

    doc.moveDown();
    doc.fontSize(15);
    rtlText(doc, "חתימה:");

    if (signature && typeof signature === "string" && signature.startsWith("data:image")) {
      const b64 = signature.replace(/^data:image\/\w+;base64,/, "");
      const sigBuffer = Buffer.from(b64, "base64");
      // מיקמנו קודם את כותרת "חתימה:", עכשיו נשים את התמונה מיושרת לימין
      const imgWidth = 150;
      const x = doc.page.width - doc.page.margins.right - imgWidth;
      const y = doc.y;
      doc.image(sigBuffer, x, y, { width: imgWidth });
      doc.moveDown(3);
    } else {
      rtlText(doc, "__________________");
    }

    doc.end();
  } catch (err) {
    console.error("Error generating PDF receipt:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deliveries/:id
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    const updated = await updateDelivery(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: "ניפוק לא נמצא" });
    }
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

