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
  getProductsGroupedByContainer,
  getProductsByContainer,
  getProductsByWarehouse, // 👈 חדש
} from "../firestoreService.js";

const router = express.Router();

// GET - כל המוצרים / חיפוש / קיבוץ לפי מכולה / פילטר לפי מכולה / פילטר לפי מחסן
router.get("/", async (req, res) => {
  try {
    const { search = "", groupBy = "", container = "", warehouseId = "" } = req.query;

    // 1) קיבוץ לפי מכולה
    if (String(groupBy).toLowerCase() === "container") {
      const grouped = await getProductsGroupedByContainer();
      return res.json({ groupedBy: "container", groups: grouped });
    }

    // 2) פילטר לפי מכולה
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

    // 3) פילטר לפי מחסן
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

    // 4) ברירת מחדל: כל המוצרים + חיפוש
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

// POST - הוספת מוצר חדש
router.post("/", async (req, res) => {
  try {
    const { name, sku, description = "", stock = 0, warehouseId = "", warehouseName = "" } = req.body;

    const cleanName = String(name || "").trim();
    const cleanSku = String(sku || "").trim().toUpperCase();
    const qty = Number(stock);

    if (!cleanName) return res.status(400).json({ error: "שם מוצר חייב להיות מחרוזת תקינה" });
    if (!cleanSku) return res.status(400).json({ error: "מקט (SKU) חובה" });
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: "מלאי חייב להיות מספר 0 ומעלה" });
    }

    const newProduct = await addProduct({
      name: cleanName,
      sku: cleanSku,
      description: String(description).trim(),
      stock: qty,
      warehouseId: String(warehouseId || "").trim(),
      warehouseName: String(warehouseName || "").trim(),
      createdAt: new Date(),
    });

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון מוצר
router.put("/:id", async (req, res) => {
  try {
    const updatedProduct = await updateProduct(req.params.id, req.body || {});
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון מלאי יחסי
router.put("/:id/stock", async (req, res) => {
  try {
    const delta = Number(req.body?.diff);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: "diff חייב להיות מספר שונה מאפס" });
    }
    const updatedProduct = await updateProductStock(req.params.id, delta);
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - מחיקת מוצר
router.delete("/:id", async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

