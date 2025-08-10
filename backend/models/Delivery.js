// firestoreDeliveryService.js
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { firebaseApp } from "./firebaseConfig";

const db = getFirestore(firebaseApp);

const COLLECTION_NAME = 'deliveries';

// הוספת אספקה חדשה
export async function addDelivery(data) {
  // data = {
  //   customer: string (id לקוח),
  //   deliveredTo: string,
  //   items: [ { product: string (id מוצר), quantity: number } ],
  //   signature: string (base64 image),
  //   date?: Date (אופציונלי)
  // }

  if (!data.customer || !data.deliveredTo || !Array.isArray(data.items) || data.items.length === 0 || !data.signature) {
    throw new Error("Missing required delivery fields");
  }

  const colRef = collection(db, COLLECTION_NAME);
  const docRef = await addDoc(colRef, {
    customer: data.customer,
    deliveredTo: data.deliveredTo,
    items: data.items.map(item => ({
      product: item.product,
      quantity: item.quantity
    })),
    signature: data.signature,
    date: data.date || new Date()
  });

  return docRef.id;
}

// שליפת כל האספקות (ניתן להוסיף פילטרים)
export async function getAllDeliveries() {
  const colRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// שליפת אספקה לפי מזהה
export async function getDeliveryById(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Delivery not found');
  return { id: docSnap.id, ...docSnap.data() };
}

// עדכון אספקה קיימת
export async function updateDelivery(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, data);
}

// מחיקת אספקה
export async function deleteDelivery(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

