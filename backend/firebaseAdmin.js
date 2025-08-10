// backend/firebaseAdmin.js
import 'dotenv/config';
import admin from 'firebase-admin';

// טען את המפתח מקודד ב־Base64 מתוך משתנה סביבה
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable');
}

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ייצוא שירותי Firebase Admin
const adminAuth = admin.auth();
const db = admin.firestore();

export { adminAuth, db };

