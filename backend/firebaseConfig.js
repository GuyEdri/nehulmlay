import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA1Sd3aloVcMFjgDsk8fDOBBkfiAfCo3Lw",
  authDomain: "nehulmlay.firebaseapp.com",
  projectId: "nehulmlay",
  storageBucket: "nehulmlay.firebasestorage.app",
  messagingSenderId: "125691926845",
  appId: "1:125691926845:web:06472c098d6bedab3c4d54",
  measurementId: "G-R6G9QKWTFL"
};

const app = initializeApp(firebaseConfig);

// לא מייבאים ולא מאתחלים getAnalytics בשרת

export const firebaseApp = app;

