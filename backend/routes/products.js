// backend/routes/products.js
import express from "express";
import {
  getAllProducts,
  getProductById,
  getProductBySku,
  addProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  // חדשים/קיימים:
  getProductsGroupedByContainer,
  getProductsByContainer,
  getProductsByWarehouse,
} from "../firestoreService.js";

const router = express.Router();

// GET - כל המוצרים / חיפוש / קיבוץ לפי מכולה / פילטר לפי מכולה / **פילטר לפי מחסן**
router.get("/", async (req, res) => {
  try {
    const { search = "", groupBy = "", container = "", warehouseId = "" } = req.query;

    // 1) קיבוץ לפי מכולה
    if (String(groupBy).toLowerCase() === "container") {
      const grouped = await getProductsGroupedByContainer();
      return res.json({ groupedBy: "container", groups: grouped });
    }

    // 2) פילטר לפי מכולה (תאימות לקוד קודם)
    if (container) {
      const items = await getProductsByContainer(container);
      const term = String(search).trim();
      let filtered = items;
      if (term) {
        const up = term.toUpperCase();
        const low = term.toLowerCase();
        filtered = items.filter((p) => {
          const name = String(p.name || "");
          const sku = String(p.sku || "");
          return name.toLowerCase().includes(low) || sku.toUpperCase().includes(up);
        });
      }
      return res.json(filtered);
    }

    // 3) **פילטר לפי מחסן** (צד שרת)
    if (warehouseId) {
      let items = await getProductsByWarehouse(warehouseId);
      const term = String(search).trim();
      if (term) {
        const up = term.toUpperCase();
        const low = term.toLowerCase();
        items = items.filter((p) => {
          const name = String(p.name || "");
          const sku = String(p.sku || "");
          return name.toLowerCase().includes(low) || sku.toUpperCase().includes(up);
        });
      }
      return res.json(items);
    }

    // 4) ברירת מחדל: כל המוצרים עם חיפוש אופציונלי
    let products = await getAllProducts();
    const term = String(search).trim();
    if (term) {
      const up = term.toUpperCase();
      const low = term.toLowerCase();
      products = products.filter((p) => {
        const name = String(p.name || "");
        const sku = String(p.sku || "");
        return name.toLowerCase().includes(low) || sku.toUpperCase().includes(up);
      });
    }

    res.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - מוצר לפי מזהה
router.get("/:id", async (req, res) => {
  try {
    const p = await getProductById(req.params.id);
    res.json(p);
  } catch (err) {
    res.status(404).json({ error: "Product not found" });
  }
});

// POST - הוספת מוצר חדש (עם SKU ייחודי + warehouseId אופציונלי)
router.post("/", async (req, res) => {
  try {
    const { name, sku, description = "", stock = 0, warehouseId = "" } = req.body;

    const cleanName = String(name || "").trim();
    const cleanSku = String(sku || "").trim().toUpperCase();
    const cleanWarehouseId = String(warehouseId || "").trim(); // "" = ללא שיוך
    const qty = Number(stock);

    if (!cleanName) {
      return res.status(400).json({ error: "שם מוצר חייב להיות מחרוזת תקינה" });
    }
    if (!cleanSku) {
      return res.status(400).json({ error: "מקט (SKU) חובה" });
    }
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: "מלאי חייב להיות מספר 0 ומעלה" });
    }

    // בדיקת ייחודיות SKU
    const existsBySku = await getProductBySku(cleanSku);
    if (existsBySku) {
      return res.status(400).json({ error: "מקט כבר קיים" });
    }

    // (אופציונלי) מניעת כפילות בשם
    const all = await getAllProducts();
    if (all.some((p) => String(p.name || "").toLowerCase() === cleanName.toLowerCase())) {
      return res.status(400).json({ error: "מוצר בשם זה כבר קיים" });
    }

    const newProduct = await addProduct({
      name: cleanName,
      sku: cleanSku,
      description: String(description).trim(),
      stock: qty,
      warehouseId: cleanWarehouseId, // 👈 נשמר ב־Firestore
      createdAt: new Date(),
    });

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון מוצר (כולל אפשרות לשנות SKU/warehouseId)
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updates = { ...req.body };

    if (updates.name != null) {
      updates.name = String(updates.name).trim();
      if (!updates.name) return res.status(400).json({ error: "שם מוצר לא תקין" });
    }

    if (updates.sku != null) {
      const newSku = String(updates.sku).trim().toUpperCase();
      if (!newSku) return res.status(400).json({ error: "מקט (SKU) לא תקין" });
      const bySku = await getProductBySku(newSku);
      if (bySku && String(bySku.id) !== String(id)) {
        return res.status(400).json({ error: "מקט כבר קיים" });
      }
      updates.sku = newSku;
    }

    if (updates.stock != null) {
      const s = Number(updates.stock);
      if (!Number.isFinite(s) || s < 0) {
        return res.status(400).json({ error: "מלאי חייב להיות מספר 0 ומעלה" });
      }
      updates.stock = s;
    }

    if (updates.warehouseId != null) {
      updates.warehouseId = String(updates.warehouseId).trim() || "";
    }

    const updatedProduct = await updateProduct(id, updates);
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון מלאי מוצר בלבד (diff - שינוי מלאי חיובי/שלילי)
router.put("/:id/stock", async (req, res) => {
  try {
    const id = req.params.id;
    const { diff } = req.body;
    const delta = Number(diff);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: "diff חייב להיות מספר שונה מאפס" });
    }
    const updatedProduct = await updateProductStock(id, delta);
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - מחיקת מוצר
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await deleteProduct(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

