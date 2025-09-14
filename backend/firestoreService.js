// backend/firestoreService.js — Admin SDK version
import { db } from "./firebaseAdmin.js";

/* ===================== עזר למכולה (container) ===================== */

// נירמול שם מכולה
const normalizeContainer = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\u0590-\u05FF/_-]/g, "")
    .toUpperCase();

// חילוץ שם מכולה מתוך תיאור טקסטואלי (עברית/אנגלית)
function extractContainer(description = "") {
  if (!description || typeof description !== "string") return "ללא מכולה";
  const text = description.trim();

  const patterns = [
    // עברית
    /מכולה[:\-\s]*([A-Za-z0-9א-ת/_-]+)\b/i,
    /קונטיינר[:\-\s]*([A-Za-z0-9א-ת/_-]+)\b/i,
    /\[(?:מכולה|קונטיינר)\s*:\s*([A-Za-z0-9א-ת/_-]+)\]/i,
    // אנגלית
    /container[:\-\s]*([A-Za-z0-9/_-]+)\b/i,
    /\[(?:container|cnt)\s*:\s*([A-Za-z0-9/_-]+)\]/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return normalizeContainer(m[1]);
  }
  return "ללא מכולה";
}

/* ========================= WAREHOUSES ========================= */

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
  if (patch.address != null) patch.address = String(patch.address).trim();
  if (patch.notes != null) patch.notes = String(patch.notes).trim();

  await ref.update(patch);
  const doc = await ref.get();
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function deleteWarehouse(id) {
  await warehousesCol.doc(String(id)).delete();
}

/* =========================== PRODUCTS =========================== */

const productsCol = db.collection("products");

export async function getAllProducts() {
  const snapshot = await productsCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

// סינון בצד-שרת לפי מחסן
export async function getProductsByWarehouse(warehouseIdRaw) {
  const wid = String(warehouseIdRaw || "").trim();
  if (!wid) return [];
  const snap = await productsCol.where("warehouseId", "==", wid).get();
  return snap.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getProductById(id) {
  const docRef = productsCol.doc(String(id));
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Product not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

// שליפה לפי SKU (מק״ט)
export async function getProductBySku(rawSku) {
  const sku = String(rawSku || "").trim().toUpperCase();
  if (!sku) return null;
  const snap = await productsCol.where("sku", "==", sku).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function addProduct(data) {
  const payload = {
    ...data,
    ...(data?.sku != null ? { sku: String(data.sku).trim().toUpperCase() } : {}),
    ...(data?.warehouseId != null ? { warehouseId: String(data.warehouseId).trim() } : {}), // "" = ללא שיוך
  };
  const docRef = await productsCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

export async function updateProduct(id, updates) {
  const patch = { ...updates };

  if (patch.sku != null) patch.sku = String(patch.sku).trim().toUpperCase();
  if (patch.warehouseId != null) patch.warehouseId = String(patch.warehouseId).trim(); // "" תקין
  if (patch.stock != null) {
    const s = Number(patch.stock);
    if (!Number.isFinite(s) || s < 0) throw new Error("Stock must be >= 0");
    patch.stock = s;
  }

  const docRef = productsCol.doc(String(id));
  await docRef.update(patch);
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function updateProductStock(id, diff) {
  const docRef = productsCol.doc(String(id));
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
  await productsCol.doc(String(id)).delete();
}

// קיבוץ מוצרים לפי "מכולה" (מהשדה container אם קיים, אחרת מתוך description)
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

  // מיון פנימי לפי שם
  Object.keys(groups).forEach((k) => {
    groups[k].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "he")
    );
  });

  return groups;
}

// מוצרים של מכולה ספציפית (תאימות קוד קיים)
export async function getProductsByContainer(containerRaw) {
  const container = String(containerRaw || "").trim().toUpperCase();
  if (!container) return [];
  const all = await getAllProducts();
  return all
    .map((p) => ({
      ...p,
      container: p.container || extractContainer(p.description || ""),
    }))
    .filter((p) => String(p.container || "").toUpperCase() === container);
}

/* =========================== CUSTOMERS =========================== */

const customersCol = db.collection("customers");

export async function getAllCustomers() {
  const snapshot = await customersCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getCustomerById(id) {
  const docRef = customersCol.doc(String(id));
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Customer not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

export async function addCustomer(data) {
  const payload = {
    name: String(data?.name || "").trim(),
    phone: data?.phone ? String(data.phone).trim() : "",
    notes: data?.notes ? String(data.notes).trim() : "",
    createdAt: new Date(),
  };
  if (!payload.name) throw new Error("Customer name is required");
  const docRef = await customersCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

export async function updateCustomer(id, updates) {
  const docRef = customersCol.doc(String(id));
  const patch = { ...updates };
  if (patch.name != null) {
    patch.name = String(patch.name).trim();
    if (!patch.name) throw new Error("Invalid customer name");
  }
  if (patch.phone != null) patch.phone = String(patch.phone).trim();
  if (patch.notes != null) patch.notes = String(patch.notes).trim();

  await docRef.update(patch);
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function deleteCustomer(id) {
  await customersCol.doc(String(id)).delete();
}

/* =========================== DELIVERIES =========================== */

const deliveriesCol = db.collection("deliveries");

/**
 * שליפה של כל הניפוקים, עם אפשרות סינון לוגי בצד השרת לפי productId.
 * הערה: Firestore לא תומך ב-query על תתי-שדות במערך של map (items[].product),
 * לכן הסינון מתבצע קצר בזיכרון אחרי שליפת כל המסמכים.
 */
export async function getAllDeliveries(productId = null) {
  const snapshot = await deliveriesCol.get();
  const list = snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));

  if (!productId) return list;

  const pid = String(productId);
  return list.filter((d) =>
    Array.isArray(d.items) && d.items.some((i) => String(i.product) === pid)
  );
}

export async function getDeliveryById(id) {
  const docRef = deliveriesCol.doc(String(id));
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Delivery not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

export async function addDelivery(data) {
  // data = { customer, customerName?, deliveredTo, items, signature, date?, personalNumber?, issuedBy*? }
  const payload = { ...data };
  const docRef = await deliveriesCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

export async function updateDelivery(id, updates) {
  const docRef = deliveriesCol.doc(String(id));
  await docRef.update({ ...updates });
  const updated = await docRef.get();
  return { id: updated.id, _id: updated.id, ...updated.data() };
}

export async function deleteDelivery(id) {
  await deliveriesCol.doc(String(id)).delete();
}

