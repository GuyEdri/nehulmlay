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

// ===== GETs =====
router.get("/", async (req, res) => {
  try {
    const deliveries = await getAllDeliveries();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "ניפוק לא נמצא" });
    res.json(delivery);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ===== POST /api/deliveries =====
router.post("/", async (req, res) => {
  try {
    const {
      warehouseId = "",            // 👈 חדש: מחסן מקור
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

    // בדיקות מלאי + שייכות למחסן (אם נבחר)
    for (const row of items) {
      if (!row?.product) return res.status(400).json({ error: "חסר מזהה מוצר בשורה" });
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty < 1)
        return res.status(400).json({ error: "כמות חייבת להיות מספר חיובי" });

      const prod = await getProductById(String(row.product));
      if (!prod) return res.status(400).json({ error: `מוצר לא נמצא: ${String(row.product)}` });

      // אם נבחר מחסן – ודא שהמוצר שייך אליו
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

    // עדכון מלאי בפועל
    for (const row of items) {
      await updateProductStock(String(row.product), -Number(row.quantity));
    }

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

// ===== PDF (ללא שינוי לוגיקה העסקית, רק תצוגה) =====
// ... (השאר כפי שהיה אצלך; אם תרצה, אפשר להוסיף הדפסה של warehouseId ב־PDF)

export default router;

