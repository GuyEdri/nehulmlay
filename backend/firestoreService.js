// firestoreService.js — Admin SDK version
import { db } from "./firebaseAdmin.js";

// ============ PRODUCTS ============
const productsCol = db.collection("products");

export async function getAllProducts() {
  const snapshot = await productsCol.get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProductById(id) {
  const docRef = productsCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Product not found");
  return { id: docSnap.id, ...docSnap.data() };
}

export async function addProduct(data) {
  const docRef = await productsCol.add(data);
  return { id: docRef.id, ...data };
}

export async function updateProduct(id, updates) {
  const docRef = productsCol.doc(id);
  await docRef.update(updates);
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() };
}

export async function updateProductStock(id, diff) {
  // טרנזאקציה בטוחה לעדכון המלאי
  const docRef = productsCol.doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("Product not found");
    const current = snap.data().stock || 0;
    const next = current + diff;
    if (next < 0) throw new Error("Stock cannot be negative");
    tx.update(docRef, { stock: next });
  });
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() };
}

export async function deleteProduct(id) {
  await productsCol.doc(id).delete();
}

// ============ CUSTOMERS ============
const customersCol = db.collection("customers");

export async function getAllCustomers() {
  const snapshot = await customersCol.get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getCustomerById(id) {
  const docRef = customersCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Customer not found");
  return { id: docSnap.id, ...docSnap.data() };
}

export async function addCustomer(data) {
  const docRef = await customersCol.add(data);
  return { id: docRef.id, ...data };
}

export async function updateCustomer(id, updates) {
  const docRef = customersCol.doc(id);
  await docRef.update(updates);
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() };
}

export async function deleteCustomer(id) {
  await customersCol.doc(id).delete();
}

// ============ DELIVERIES ============
const deliveriesCol = db.collection("deliveries");

export async function getAllDeliveries() {
  // מחזיר את כל הניפוקים; סינון לפי מוצר יתבצע בצד לקוח
  const snapshot = await deliveriesCol.get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDeliveryById(id) {
  const docRef = deliveriesCol.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error("Delivery not found");
  return { id: docSnap.id, ...docSnap.data() };
}

export async function addDelivery(data) {
  // data = { customer, customerName?, deliveredTo, items, signature, date? }
  const payload = { ...data };
  const docRef = await deliveriesCol.add(payload);
  return { id: docRef.id, ...payload };
}

export async function updateDelivery(id, updates) {
  const docRef = deliveriesCol.doc(id);
  await docRef.update(updates);
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() };
}

export async function deleteDelivery(id) {
  await deliveriesCol.doc(id).delete();
}

