// firestoreService.js — Admin SDK version
import { db } from "./firebaseAdmin.js";

// ============ PRODUCTS ============
const productsCol = db.collection("products");

export async function getAllProducts() {
  const snapshot = await productsCol.get();
  return snapshot.docs.map((d) => ({ id: d.id, _id: d.id, ...d.data() }));
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
  };
  const docRef = await productsCol.add(payload);
  return { id: docRef.id, _id: docRef.id, ...payload };
}

export async function updateProduct(id, updates) {
  // נירמול SKU אם עודכן
  const patch =
    updates?.sku != null
      ? { ...updates, sku: String(updates.sku).trim().toUpperCase() }
      : { ...updates };

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
  // מחזיר את כל הניפוקים; סינון לפי מוצר בצד לקוח/ראוטר
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
  // data = { customer, customerName?, deliveredTo, items, signature, date? }
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

