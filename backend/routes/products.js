// backend/routes/products.js
import express from "express";
import {
  getAllProducts,
  getProductsByWarehouse,
  getProductsByWarehouseName,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getProductsGroupedByContainer,
  getProductsByContainer,
} from "../firestoreService.js";

const router = express.Router();

// GET - חיפוש/קיבוץ/סינון לפי מחסן (ID או שם)
router.get("/", async (req, res) => {
  try {
    const { search = "", groupBy = "", container = "", warehouseId = "", warehouseName = "" } = req.query;

    if (String(groupBy).toLowerCase() === "container") {
      const grouped = await getProductsGroupedByContainer();
      return res.json({ groupedBy: "container", groups: grouped });
    }

    if (container) {
      const items = await getProductsByContainer(container);
      const term = String(search).trim();
      const filtered = term
        ? items.filter((p) => {
            const up = term.toUpperCase();
            const low = term.toLowerCase();
            return String(p.name || "").toLowerCase().includes(low) ||
                   String(p.sku || "").toUpperCase().includes(up);
          })
        : items;
      return res.json(filtered);
    }

    if (warehouseId) {
      const items = await getProductsByWarehouse(warehouseId);
      const term = String(search).trim();
      const filtered = term
        ? items.filter((p) => {
            const up = term.toUpperCase();
            const low = term.toLowerCase();
            return String(p.name || "").toLowerCase().includes(low) ||
                   String(p.sku || "").toUpperCase().includes(up);
          })
        : items;
      return res.json(filtered);
    }

    if (warehouseName) {
      const items = await getProductsByWarehouseName(warehouseName);
      const term = String(search).trim();
      const filtered = term
        ? items.filter((p) => {
            const up = term.toUpperCase();
            const low = term.toLowerCase();
            return String(p.name || "").toLowerCase().includes(low) ||
                   String(p.sku || "").toUpperCase().includes(up);
          })
        : items;
      return res.json(filtered);
    }

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
  } catch {
    res.status(404).json({ error: "Product not found" });
  }
});

// POST - הוספת/עדכון (UPSERT) מוצר לפי (SKU, מחסן)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      sku,
      description = "",
      stock = 0,
      warehouseId = "",
      warehouseName = "",
    } = req.body;

    const product = await addProduct({
      name,
      sku,
      description,
      stock,
      warehouseId,
      warehouseName,
    });

    // אם בוצע upsert נחזיר 200 רגיל, אחרת 201
    const status = product?._upsert ? 200 : 201;
    res.status(status).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT - עדכון מוצר
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updates = { ...req.body };
    const updatedProduct = await updateProduct(id, updates);
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT - עדכון מלאי יחסי
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

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

