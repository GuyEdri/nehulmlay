// backend/firestoreService.js
import { db } from "./firebaseAdmin.js";

/* ================== Helpers ================== */
function normalizeWid(v) {
  const s = String(v ?? "").trim();
  return s === "null" || s === "undefined" ? "" : s;
}
function isEmptyWid(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

/* ================== WAREHOUSES ================== */
const warehousesCol = db.collection("warehouses");

export async function getAllWarehouses() {
  const snap = await warehousesCol.get();
  return snap.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getWarehouseById(id) {
  const ref = warehousesCol.doc(String(id));
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Warehouse not found");
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function addWarehouse(data) {
  const payload = {
    name: String(data?.name || "").trim(),
    address: data?.address ? String(data.address).trim() : "",
    notes: data?.notes ? String(data.notes).trim() : "",
    createdAt: new Date(),
  };
  if (!payload.name) throw new Error("Warehouse name is required");
  const ref = await warehousesCol.add(payload);
  return { id: ref.id, _id: ref.id, ...payload };
}

export async function updateWarehouse(id, updates) {
  const ref = warehousesCol.doc(String(id));
  const patch = { ...updates };
  if (patch.name != null) {
    patch.name = String(patch.name).trim();
    if (!patch.name) throw new Error("Invalid warehouse name");
  }
  await ref.update(patch);
  const doc = await ref.get();
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function deleteWarehouse(id) {
  await warehousesCol.doc(String(id)).delete();
}

/* ================== PRODUCTS ================== */
const productsCol = db.collection("products");

export async function getAllProducts() {
  const snapshot = await productsCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getProductsByWarehouse(warehouseIdRaw) {
  const wid = normalizeWid(warehouseIdRaw);
  const snap = await productsCol.where("warehouseId", "==", wid).get();
  return snap.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getProductById(id) {
  const docRef = productsCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Product not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

/* --- Find product by SKU in a specific warehouse, handling legacy docs --- */
async function getProductBySkuAndWarehouseFlexible(sku, warehouseId) {
  const wid = normalizeWid(warehouseId);

  // 1) Exact match
  let snap = await productsCol
    .where("sku", "==", sku)
    .where("warehouseId", "==", wid)
    .limit(1)
    .get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { doc: d, data: d.data(), reason: "exact" };
  }

  // 2) If warehouse is empty, look for legacy docs without warehouseId
  if (wid === "") {
    const allSku = await productsCol.where("sku", "==", sku).get();
    const legacy = allSku.docs.filter((d) => isEmptyWid(d.data().warehouseId));
    if (legacy.length === 1) {
      return { doc: legacy[0], data: legacy[0].data(), reason: "legacy-empty" };
    }
    return null;
  }

  // 3) If warehouse not empty, allow migrating one legacy doc to this warehouse
  const allSku = await productsCol.where("sku", "==", sku).get();
  const legacy = allSku.docs.filter((d) => isEmptyWid(d.data().warehouseId));
  const inTarget = allSku.docs.find(
    (d) => normalizeWid(d.data().warehouseId) === wid
  );

  if (!inTarget && legacy.length === 1) {
    return { doc: legacy[0], data: legacy[0].data(), reason: "migrate-legacy-to-target" };
  }

  return null;
}

/* === Add or Update (Upsert) Product === */
export async function addProduct(data) {
  const name = String(data?.name || "").trim();
  const sku = String(data?.sku || "").trim().toUpperCase();
  const stockToAdd = Number(data?.stock ?? 0);
  const warehouseId = normalizeWid(data?.warehouseId);
  const warehouseName = String(data?.warehouseName || "").trim();

  if (!name) throw new Error("שם מוצר נדרש");
  if (!sku) throw new Error("מקט (SKU) נדרש");
  if (!Number.isFinite(stockToAdd) || stockToAdd < 0) {
    throw new Error("כמות חייבת להיות 0 ומעלה");
  }

  // Look for existing product with same SKU and warehouse
  const match = await getProductBySkuAndWarehouseFlexible(sku, warehouseId);

  if (match) {
    const { doc, data: cur, reason } = match;
    const docRef = productsCol.doc(doc.id);
    const patch = {
      stock: Number(cur.stock || 0) + stockToAdd,
    };
    if (name) patch.name = name;
    if (data?.description !== undefined) {
      patch.description = String(data.description || "").trim();
    }
    if (warehouseName) patch.warehouseName = warehouseName;

    // If migrating legacy doc to target warehouse
    if (reason === "migrate-legacy-to-target") {
      patch.warehouseId = warehouseId;
      patch.warehouseName = warehouseName;
    } else if (reason === "legacy-empty" && warehouseId === "") {
      patch.warehouseId = "";
      patch.warehouseName = "";
    }

    await docRef.update(patch);
    const updated = await docRef.get();
    return { id: updated.id, _id: updated.id, ...updated.data(), _upsert: true };
  }

  // Create new product if none found
  const payload = {
    name,
    sku,
    description: String(data?.description || "").trim(),
    stock: stockToAdd,
    warehouseId,
    warehouseName,
    createdAt: new Date(),
  };
  const docRef = await productsCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

/* === Update existing product === */
export async function updateProduct(id, updates) {
  const patch = { ...updates };
  const current = await getProductById(id);

  if (patch.name != null) patch.name = String(patch.name).trim();

  if (patch.sku != null) {
    const newSku = String(patch.sku).trim().toUpperCase();
    if (!newSku) throw new Error("מקט (SKU) לא תקין");

    // Ensure uniqueness of SKU within the same warehouse
    const wid = normalizeWid(current.warehouseId);
    const allSku = await productsCol.where("sku", "==", newSku).get();
    const dup = allSku.docs.find(
      (d) => d.id !== id && normalizeWid(d.data().warehouseId) === wid
    );
    if (dup) throw new Error("מקט כבר קיים במחסן הזה");

    patch.sku = newSku;
  }

  if (patch.stock != null) patch.stock = Number(patch.stock);

  // Change warehouse if requested
  if (patch.warehouseId !== undefined || patch.warehouseName !== undefined) {
    const newWid = normalizeWid(patch.warehouseId ?? current.warehouseId);
    const newWname = String(
      patch.warehouseName ?? current.warehouseName ?? ""
    ).trim();

    // Ensure no duplication with new SKU/warehouse pair
    const newSku = ((patch.sku ?? current.sku) || "").toUpperCase(); // ✅ fixed parentheses
    const allSku = await productsCol.where("sku", "==", newSku).get();
    const dup = allSku.docs.find(
      (d) => d.id !== id && normalizeWid(d.data().warehouseId) === newWid
    );
    if (dup) throw new Error("מקט כבר קיים במחסן היעד");

    patch.warehouseId = newWid;
    patch.warehouseName = newWname;
  }

  const docRef = productsCol.doc(id);
  await docRef.update(patch);
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function deleteProduct(id) {
  await productsCol.doc(id).delete();
}

/* ================== DELIVERIES ================== */
const deliveriesCol = db.collection("deliveries");

export async function getAllDeliveries() {
  const snapshot = await deliveriesCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

