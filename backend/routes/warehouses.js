// backend/routes/warehouses.js
import express from "express";
import {
  getAllWarehouses,
  getWarehouseById,
  addWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../firestoreService.js";

const router = express.Router();

// GET /api/warehouses
router.get("/", async (req, res) => {
  try {
    const list = await getAllWarehouses();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/warehouses/:id
router.get("/:id", async (req, res) => {
  try {
    const one = await getWarehouseById(req.params.id);
    res.json(one);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// POST /api/warehouses
router.post("/", async (req, res) => {
  try {
    const created = await addWarehouse(req.body || {});
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/warehouses/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await updateWarehouse(req.params.id, req.body || {});
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/warehouses/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteWarehouse(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

