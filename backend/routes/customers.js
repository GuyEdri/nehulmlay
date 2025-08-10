import express from 'express';
import {
  getAllCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
} from '../firestoreService.js';

const router = express.Router();

// GET - כל הלקוחות
router.get('/', async (req, res) => {
  try {
    const customers = await getAllCustomers();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - הוספת לקוח חדש
router.post('/', async (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'שם לקוח חייב להיות מחרוזת תקינה' });
    }

    const newCustomer = await addCustomer({
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    res.json(newCustomer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - עדכון לקוח
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updatedCustomer = await updateCustomer(id, updates);
    res.json(updatedCustomer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - מחיקת לקוח
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await deleteCustomer(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

