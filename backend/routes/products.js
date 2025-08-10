import express from 'express';
import {
  getAllProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
} from '../firestoreService.js';

const router = express.Router();

// GET - כל המוצרים, אפשרות חיפוש בשם
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let products = await getAllProducts();
    if (search) {
      const lowerSearch = search.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(lowerSearch));
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - הוספת מוצר חדש
router.post('/', async (req, res) => {
  try {
    const { name, description, stock } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'שם מוצר חייב להיות מחרוזת תקינה' });
    }

    // בדיקה אם מוצר קיים כבר (באופן פשוט)
    const products = await getAllProducts();
    if (products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'מוצר בשם זה כבר קיים' });
    }

    const newProduct = await addProduct({
      name: name.trim(),
      description: description ? description.trim() : '',
      stock: typeof stock === 'number' ? stock : 0,
    });

    res.json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון מוצר (שם, תיאור, מלאי)
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updatedProduct = await updateProduct(id, updates);
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון מלאי מוצר בלבד (diff - שינוי מלאי חיובי/שלילי)
router.put('/:id/stock', async (req, res) => {
  try {
    const id = req.params.id;
    const { diff } = req.body;
    if (typeof diff !== 'number') {
      return res.status(400).json({ error: 'diff חייב להיות מספר' });
    }
    const updatedProduct = await updateProductStock(id, diff);
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - מחיקת מוצר
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await deleteProduct(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

