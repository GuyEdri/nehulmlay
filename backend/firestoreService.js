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

// חילוץ "מכולה" מטקסט תיאור (עבור groupBy=container)
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
    if (m && m[1]) return String(m[1]).toUpperCase();
  }
  return "ללא מכולה";
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
  if (patch.address != null) patch.address = String(patch.address).trim();
  if (patch.notes != null) patch.notes = String(patch.notes).trim();
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
  if (wid === "") {
    // אי אפשר לשאול Firestore על "חסר שדה", לכן נבצע סריקה מלאה וסינון בזיכרון
    const all = await getAllProducts();
    return all.filter((p) => isEmptyWid(p.warehouseId));
  }
  const snap = await productsCol.where("warehouseId", "==", wid).get();
  return snap.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getProductById(id) {
  const docRef = productsCol.doc(String(id));
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Product not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

export async function getProductBySku(rawSku) {
  const sku = String(rawSku || "").trim().toUpperCase();
  if (!sku) return null;
  const snap = await productsCol.where("sku", "==", sku).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

/** מציאת מוצר לפי (SKU, warehouseId) — מתחשב גם במסמכי legacy ללא warehouseId */
async function getProductBySkuAndWarehouseFlexible(sku, warehouseId) {
  const wid = normalizeWid(warehouseId);

  // חיפוש מדויק
  let snap = await productsCol.where("sku", "==", sku).where("warehouseId", "==", wid).limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { doc: d, data: d.data(), reason: "exact" };
  }

  // אם יעד ריק ("ללא שיוך"): בדוק מסמך יחיד ללא שדה warehouseId/"".
  const allSku = await productsCol.where("sku", "==", sku).get();
  if (wid === "") {
    const legacy = allSku.docs.filter((d) => isEmptyWid(d.data().warehouseId));
    if (legacy.length === 1) {
      return { doc: legacy[0], data: legacy[0].data(), reason: "legacy-empty" };
    }
    return null;
  }

  // יעד לא ריק: אם יש legacy יחיד וללא התנגשות במחסן היעד—אפשר "להגר" אותו ליעד
  const legacy = allSku.docs.filter((d) => isEmptyWid(d.data().warehouseId));
  const inTarget = allSku.docs.find((d) => normalizeWid(d.data().warehouseId) === wid);
  if (!inTarget && legacy.length === 1) {
    return { doc: legacy[0], data: legacy[0].data(), reason: "migrate-legacy-to-target" };
  }

  return null;
}

/** UPSERT לפי (SKU, מחסן): אם קיים—עדכון מלאי ושדות; אחרת—יצירה חדשה */
export async function addProduct(data) {
  const name = String(data?.name || "").trim();
  const sku = String(data?.sku || "").trim().toUpperCase();
  const stockToAdd = Number(data?.stock ?? 0);
  const warehouseId = normalizeWid(data?.warehouseId);
  const warehouseName = data?.warehouseName ? String(data.warehouseName).trim() : "";

  if (!name) throw new Error("שם מוצר חייב להיות מחרוזת תקינה");
  if (!sku) throw new Error("מקט (SKU) חובה");
  if (!Number.isFinite(stockToAdd) || stockToAdd < 0) {
    throw new Error("מלאי חייב להיות מספר 0 ומעלה");
  }

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
    // עדכון שדות מחסן במקרה שמתאימים להגרה/קיבוע סכימה
    if (reason === "migrate-legacy-to-target" || (reason === "legacy-empty" && warehouseId !== "")) {
      patch.warehouseId = warehouseId;
      patch.warehouseName = warehouseName;
    } else if (reason === "legacy-empty" && warehouseId === "") {
      patch.warehouseId = "";
      patch.warehouseName = "";
    }
    if (warehouseName) patch.warehouseName = warehouseName;

    await docRef.update(patch);
    const updated = await docRef.get();
    return { id: updated.id, _id: updated.id, ...updated.data(), _upsert: true, _reason: reason };
  }

  // יצירה חדשה
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

export async function updateProduct(id, updates) {
  const current = await getProductById(id);
  const patch = { ...updates };

  if (patch.name != null) {
    patch.name = String(patch.name).trim();
    if (!patch.name) throw new Error("שם מוצר לא תקין");
  }

  if (patch.sku != null) {
    const newSku = String(patch.sku).trim().toUpperCase();
    if (!newSku) throw new Error("מקט (SKU) לא תקין");

    // ייחודיות בתוך אותו מחסן (מתחשב ב-legacy):
    const wid = normalizeWid(current.warehouseId);
    const allSku = await productsCol.where("sku", "==", newSku).get();
    const dup = allSku.docs.find(
      (d) => d.id !== String(id) && normalizeWid(d.data().warehouseId) === wid
    );
    if (dup) throw new Error("מקט כבר קיים במחסן הזה");

    patch.sku = newSku;
  }

  if (patch.stock != null) {
    const s = Number(patch.stock);
    if (!Number.isFinite(s) || s < 0) throw new Error("מלאי חייב להיות מספר 0 ומעלה");
    patch.stock = s;
  }

  // שינוי שיוך מחסן (נבדוק גם ייחודיות SKU ביעד)
  if (patch.warehouseId !== undefined || patch.warehouseName !== undefined) {
    const targetWarehouseId = normalizeWid(
      patch.warehouseId !== undefined ? patch.warehouseId : current.warehouseId
    );
    const targetWarehouseName =
      patch.warehouseName !== undefined ? String(patch.warehouseName).trim() : (current.warehouseName || "");

    const newSkuForCheck = (patch.sku !== undefined ? String(patch.sku) : String(current.sku)).toUpperCase();

    const allSku = await productsCol.where("sku", "==", newSkuForCheck).get();
    const dup = allSku.docs.find(
      (d) => d.id !== String(id) && normalizeWid(d.data().warehouseId) === targetWarehouseId
    );
    if (dup) throw new Error("מקט כבר קיים במחסן היעד");

    patch.warehouseId = targetWarehouseId;
    patch.warehouseName = targetWarehouseName;
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

/** קיבוץ מוצרים לפי "מכולה" (name/sku/description → extract) */
export async function getProductsGroupedByContainer() {
  const snapshot = await productsCol.get();
  const groups = {};
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const desc = data.description || "";
    const container = (data.container && String(data.container).trim()) || extractContainer(desc);
    if (!groups[container]) groups[container] = [];
    groups[container].push({ id: doc.id, _id: doc.id, ...data, container });
  });
  Object.keys(groups).forEach((k) => {
    groups[k].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he"));
  });
  return groups;
}

/** מוצרים של מכולה ספציפית (לצורך תאימות לקוד קיים) */
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

/* ================== CUSTOMERS ================== */
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
  if (!payload.name) throw new Error("Customer name required");
  const ref = await customersCol.add(payload);
  return { id: ref.id, _id: ref.id, ...payload };
}

export async function updateCustomer(id, updates) {
  const ref = customersCol.doc(String(id));
  const patch = { ...updates };
  if (patch.name != null) {
    patch.name = String(patch.name).trim();
    if (!patch.name) throw new Error("Invalid customer name");
  }
  if (patch.phone != null) patch.phone = String(patch.phone).trim();
  if (patch.notes != null) patch.notes = String(patch.notes).trim();
  await ref.update(patch);
  const doc = await ref.get();
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function deleteCustomer(id) {
  await customersCol.doc(String(id)).delete();
}

/* ================== DELIVERIES ================== */
const deliveriesCol = db.collection("deliveries");

/** תמיכה בסינון אופציונלי לפי productId (כמו שהראוטר שלך קורא) */
export async function getAllDeliveries(productId = null) {
  if (productId) {
    const pid = String(productId);
    const snap = await deliveriesCol.get();
    const list = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.some((i) => String(i.product) === pid)) {
        list.push({ id: d.id, _id: d.id, ...data });
      }
    });
    return list;
  }
  const snapshot = await deliveriesCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
}

export async function getDeliveryById(id) {
  const docRef = deliveriesCol.doc(String(id));
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Delivery not found");
  return { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
}

export async function addDelivery(data) {
  const payload = { ...data };
  const ref = await deliveriesCol.add(payload);
  return { id: ref.id, _id: ref.id, ...payload };
}

export async function updateDelivery(id, updates) {
  const ref = deliveriesCol.doc(String(id));
  await ref.update({ ...updates });
  const doc = await ref.get();
  return { id: doc.id, _id: doc.id, ...doc.data() };
}

export async function deleteDelivery(id) {
  await deliveriesCol.doc(String(id)).delete();
}

