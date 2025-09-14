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
  getProductsByWarehouse,       // 👈 סינון שרת לפי מחסן
  getProductsGroupedByContainer
} from "../firestoreService.js";

const router = express.Router();

/**
 * GET /api/products
 * תמיכה:
 *  - ?search=...         חיפוש בשם/מקט (בצד שרת אחרי שליפה)
 *  - ?warehouse=<id>     סינון לפי מחסן (בצד שרת!)
 *  - ?groupBy=container  קיבוץ לפי "מכולה" (לפי description או שדה container)
 */
router.get("/", async (req, res) => {
  try {
    const { search = "", groupBy = "", warehouse = "" } = req.query;

    // 1) קיבוץ לפי מכולה
    if (String(groupBy).toLowerCase() === "container") {
      const grouped = await getProductsGroupedByContainer();
      return res.json({ groupedBy: "container", groups: grouped });
    }

    const term = String(search || "").trim();
    const needleUp = term.toUpperCase();
    const needleLow = term.toLowerCase();

    let items = [];

    // 2) סינון שרת לפי מחסן
    const wid = String(warehouse || "").trim();
    if (wid) {
      items = await getProductsByWarehouse(wid);
    } else {
      items = await getAllProducts();
    }

    // 3) חיפוש (שם/מקט) לאחר הסינון הראשוני
    if (term) {
      items = items.filter((p) => {
        const name = String(p.name || "");
        const sku = String(p.sku || "");
        return (
          name.toLowerCase().includes(needleLow) ||
          sku.toUpperCase().includes(needleUp)
        );
      });
    }

    return res.json(items);
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const p = await getProductById(req.params.id);
    res.json(p);
  } catch {
    res.status(404).json({ error: "Product not found" });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const { name, sku, description = "", stock = 0, warehouseId = "" } = req.body;

    const cleanName = String(name || "").trim();
    const cleanSku = String(sku || "").trim().toUpperCase();
    const qty = Number(stock);
    const wid = String(warehouseId || "").trim(); // ריק = ללא שיוך

    if (!cleanName) return res.status(400).json({ error: "שם מוצר חייב להיות מחרוזת תקינה" });
    if (!cleanSku) return res.status(400).json({ error: "מקט (SKU) חובה" });
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
      warehouseId: wid,      // 👈 שמירה מסודרת של שיוך מחסן
      createdAt: new Date(),
    });

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
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

      // ודא ייחודיות מק״ט מול מוצרים אחרים
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

    // 👇 נרמול שיוך מחסן
    if (updates.warehouseId != null) {
      updates.warehouseId = String(updates.warehouseId).trim(); // "" = ללא שיוך
    }

    const updatedProduct = await updateProduct(id, updates);
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id/stock
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

// DELETE /api/products/:id
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

