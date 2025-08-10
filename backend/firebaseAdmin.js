// firebaseAdmin.js
import admin from 'firebase-admin';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };

// אתחל את האדמין עם מפתח השירות שלך
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };

