// models/Customer.js
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { firebaseApp } from "../firebaseConfig.js"; // נניח שיש לך קובץ config ל-Firebase

const db = getFirestore(firebaseApp);
const customersCollection = collection(db, "customers");

export async function getAllCustomers() {
  const snapshot = await getDocs(customersCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCustomerById(id) {
  const docRef = doc(customersCollection, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Customer not found");
  return { id: docSnap.id, ...docSnap.data() };
}

export async function createCustomer(data) {
  // ניתן להוסיף בדיקות תוקף לפני
  const docRef = await addDoc(customersCollection, data);
  return { id: docRef.id, ...data };
}

export async function updateCustomer(id, data) {
  const docRef = doc(customersCollection, id);
  await updateDoc(docRef, data);
  return getCustomerById(id);
}

export async function deleteCustomer(id) {
  const docRef = doc(customersCollection, id);
  await deleteDoc(docRef);
  return { success: true };
}

