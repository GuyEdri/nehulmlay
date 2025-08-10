// firestoreService.js
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { firebaseApp } from "./firebaseConfig";

const db = getFirestore(firebaseApp);

const COLLECTION_NAME = 'products';

// קבלת כל המוצרים
export async function getAllProducts() {
  const colRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// קבלת מוצר לפי מזהה
export async function getProductById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Product not found');
  return { id: docSnap.id, ...docSnap.data() };
}

// הוספת מוצר חדש
export async function addProduct(data) {
  // data = { name, description?, stock? }
  const colRef = collection(db, COLLECTION_NAME);
  const docRef = await addDoc(colRef, {
    name: data.name.trim(),
    description: data.description ? data.description.trim() : "",
    stock: data.stock || 0,
  });
  return docRef.id;
}

// עדכון מוצר קיים
export async function updateProduct(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, data);
}

// מחיקת מוצר
export async function deleteProduct(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

