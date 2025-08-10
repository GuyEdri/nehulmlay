// backend/middleware/auth.js
import { adminAuth } from "../firebaseAdmin.js";

export async function verifyAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const m = header.match(/^Bearer (.+)$/);
    if (!m) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const idToken = m[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.user = decoded; // { uid, email, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

