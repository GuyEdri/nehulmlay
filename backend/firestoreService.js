// firestoreService.js — Admin SDK version
import { db } from "./firebaseAdmin.js";

// ================== עזר: חילוץ מכולה מהתיאור ==================
function extractContainer(description = "") {
  if (!description || typeof description !== "string") return "ללא מכולה";
  const text = description.trim();

  const patterns = [
    // עברית
    /מכולה[:\-\s]*([A-Za-z0-9א-ת]+)\b/i,
    /קונטיינר[:\-\s]*([A-Za-z0-9א-ת]+)\b/i,
    /\[(?:מכולה|קונטיינר)\s*:\s*([A-Za-z0-9א-ת]+)\]/i,
    // אנגלית
    /container[:\-\s]*([A-Za-z0-9\-]+)\b/i,
    /\[(?:container|cnt)\s*:\s*([A-Za-z0-9\-]+)\]/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return String(m[1]).toUpperCase();
  }
  return "ללא מכולה";
}

// ============ PRODUCTS ============
const productsCol = db.collection("products");

export async function getAllProducts() {
  const snapshot = await productsCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getProductsByWarehouse(warehouseIdRaw) {
  const wid = String(warehouseIdRaw || "").trim();
  if (!wid) return [];
  const snap = await productsCol.where("warehouseId", "==", wid).get();
  return snap.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getProductById(id) {
  const docRef = productsCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Product not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

// חדש: שליפה לפי SKU (מקט)
export async function getProductBySku(rawSku) {
  const sku = String(rawSku || "").trim().toUpperCase();
  if (!sku) return null;
  const snap = await productsCol.where("sku", "==", sku).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function addProduct(data) {
  // נירמול שדות
  const payload = {
    ...data,
    ...(data?.sku != null ? { sku: String(data.sku).trim().toUpperCase() } : {}),
    ...(data?.warehouseId != null
      ? { warehouseId: String(data.warehouseId).trim() || "" }
      : {}),
  };
  const docRef = await productsCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

export async function updateProduct(id, updates) {
  // נירמול
  const patch = { ...updates };

  if (patch.sku != null) {
    patch.sku = String(patch.sku).trim().toUpperCase();
  }
  if (patch.warehouseId != null) {
    patch.warehouseId = String(patch.warehouseId).trim() || "";
  }
  if (patch.stock != null) {
    patch.stock = Number(patch.stock);
  }

  const docRef = productsCol.doc(id);
  await docRef.update(patch);
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function updateProductStock(id, diff) {
  // טרנזאקציה בטוחה לעדכון המלאי
  const docRef = productsCol.doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("Product not found");
    const current = Number(snap.data().stock || 0);
    const next = current + Number(diff || 0);
    if (!Number.isFinite(next) || next < 0) throw new Error("Stock cannot be negative");
    tx.update(docRef, { stock: next });
  });
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function deleteProduct(id) {
  await productsCol.doc(id).delete();
}

/** חדש: החזרת מוצרים כשהם מקובצים לפי מכולה */
export async function getProductsGroupedByContainer() {
  const snapshot = await productsCol.get();
  const groups = {};

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const desc = data.description || "";
    const container =
      (data.container && String(data.container).trim()) || extractContainer(desc);

    if (!groups[container]) groups[container] = [];
    groups[container].push({ id: doc.id, _id: doc.id, ...data, container });
  });

  Object.keys(groups).forEach((k) => {
    groups[k].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "he")
    );
  });

  return groups;
}

/** אופציונלי: מוצרים של מכולה ספציפית (לצורך תאימות קוד קיים) */
export async function getProductsByContainer(containerRaw) {
  const container = String(containerRaw || "").trim().toUpperCase();
  if (!container) return [];
  const all = await getAllProducts();
  return all
    .map((p) => ({
      ...p,
      container: p.container || extractContainer(p.description || ""),
    }))
    .filter((p) => p.container.toUpperCase() === container);
}

// ============ CUSTOMERS ============
const customersCol = db.collection("customers");

export async function getAllCustomers() {
  const snapshot = await customersCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getCustomerById(id) {
  const docRef = customersCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Customer not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

export async function addCustomer(data) {
  const docRef = await customersCol.add(data);
  return { id: docRef.id, _id: docRef.id, ...data };
}

export async function updateCustomer(id, updates) {
  const docRef = customersCol.doc(id);
  await docRef.update(updates);
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function deleteCustomer(id) {
  await customersCol.doc(id).delete();
}

// ============ DELIVERIES ============
const deliveriesCol = db.collection("deliveries");

export async function getAllDeliveries() {
  const snapshot = await deliveriesCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getDeliveryById(id) {
  const docRef = deliveriesCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Delivery not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

export async function addDelivery(data) {
  const payload = { ...data };
  const docRef = await deliveriesCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

export async function updateDelivery(id, updates) {
  const docRef = deliveriesCol.doc(id);
  await docRef.update(updates);
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function deleteDelivery(id) {
  await deliveriesCol.doc(id).delete();
}

