// backend/firebaseAdmin.js
import 'dotenv/config';
import admin from 'firebase-admin';

// טען את המפתח מקודד ב־Base64 מתוך משתנה סביבה
const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!saB64) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable');
}

const serviceAccount = JSON.parse(
  Buffer.from(saB64, 'base64').toString('utf8')
);

// מניעת אתחול כפול (נחוץ עם nodemon וכו')
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // חשוב כדי למנוע "Unable to detect a Project Id"
    projectId: serviceAccount.project_id,
  });
}

// ייצוא שירותי Firebase Admin
export const adminAuth = admin.auth();
export const db = admin.firestore();

