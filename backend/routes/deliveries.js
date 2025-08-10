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
    const { customer, customerName, deliveredTo, items, signature, date } =
      req.body;

    // שים לב: בגלל חתימה ב־base64 צריך להגדיל את limit של express.json באפליקציה הראשית (למשל 5mb)
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
        return res
          .status(400)
          .json({ error: "כמות חייבת להיות מספר חיובי בשורה" });
      }
    }

    // 1) בדיקת מלאי לכל המוצרים
    for (const row of items) {
      const prod = await getProductById(String(row.product));
      if (!prod) {
        return res
          .status(400)
          .json({ error: `מוצר לא נמצא: ${String(row.product)}` });
      }
      const qty = Number(row.quantity);
      const stock = Number(prod.stock ?? 0);
      if (stock < qty) {
        return res.status(400).json({
          error: `אין מספיק מלאי עבור "${prod.name}". במלאי: ${stock}, ביקשת: ${qty}`,
        });
      }
    }

    // 2) עדכון מלאי בפועל
    // הערה: אידאלי לבצע זאת בעסקה (transaction) כדי למנוע מרוצים במקביל.
    // אם יש לכם wrapper ב-firestoreService לעסקאות — עדיף להשתמש בו.
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

    if (!signature) {
      signature = delivery.signature;
    }

    // שליפת שם הלקוח (אם לא נשלח כבר כשדה בניפוק)
    let customerName = delivery.customerName || "";
    if (!customerName && delivery.customer) {
      try {
        const customer = await getCustomerById(delivery.customer);
        customerName = customer ? customer.name : "";
      } catch {
        customerName = "";
      }
    }

    // שליפת פרטי מוצרים
    let products = [];
    try {
      products = await Promise.all(
        (delivery.items || []).map(async (item) => {
          try {
            const prod = await getProductById(item.product);
            return {
              name: prod?.name || "מוצר לא ידוע",
              quantity: item.quantity,
            };
          } catch {
            return { name: "מוצר לא ידוע", quantity: item.quantity };
          }
        })
      );
    } catch {
      products = [];
    }

    // פונט עברי
    const fontPath = path.resolve(__dirname, "../fonts/noto.ttf"); // התאם את הנתיב לפי הפרויקט
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
      res.setHeader(
        "Content-Disposition",
        // שומר על שם קובץ באנגלית כדי להימנע מבעיות קידוד בכרום
        "attachment; filename=receipt.pdf"
      );
      res.send(pdfData);
    });

    // סימון RTL
    const rtl = "\u200F";

    // כותרת
    doc.fontSize(22).text(`${rtl}קבלה על ניפוק מלאי`, { align: "right" });
    doc.moveDown();

    // פרטים כלליים
    doc.fontSize(16).text(`${rtl}לקוח: ${customerName}`, { align: "right" });
    doc.text(`${rtl}נופק למי: ${delivery.deliveredTo}`, { align: "right" });

    // תאריך
    let dateText = "";
    try {
      const d = new Date(delivery.date);
      if (!Number.isNaN(d.getTime())) {
        dateText = d.toLocaleString("he-IL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      dateText = "";
    }
    doc.text(`${rtl}תאריך: ${dateText}`, { align: "right" });

    doc.moveDown();
    doc.fontSize(18).text(`${rtl}מוצרים שנופקו:`, { align: "right" });

    if (!products.length) {
      doc.fontSize(14).text(`${rtl}לא נבחרו מוצרים`, { align: "right" });
    } else {
      products.forEach((p, i) => {
        doc
          .fontSize(15)
          .text(
            `${rtl}${i + 1}. ${p.name}   |   כמות: ${p.quantity}`,
            { align: "right" }
          );
      });
    }

    doc.moveDown();
    doc.fontSize(15).text(`${rtl}חתימה:`, { align: "right" });

    // החתימה בבסיס64 (תומך png/jpg)
    if (
      signature &&
      typeof signature === "string" &&
      signature.startsWith("data:image")
    ) {
      const b64 = signature.replace(/^data:image\/\w+;base64,/, "");
      const sigBuffer = Buffer.from(b64, "base64");
      // מציב את החתימה בקצה הימני
      const x = doc.page.width - 200;
      const y = doc.y;
      doc.image(sigBuffer, x, y, { width: 150 });
      doc.moveDown(3);
    } else {
      doc.text(`${rtl}__________________`, { align: "right" });
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

