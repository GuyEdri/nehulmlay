// backend/middleware/auth.js
import admin from "../firebaseAdmin.js";

export async function verifyAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: "Missing Authorization header" });

    const idToken = m[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    // ניתן להוסיף בדיקות תפקידים/רשימות מורשות כאן אם תרצה
    req.user = decoded; // { uid, email, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

