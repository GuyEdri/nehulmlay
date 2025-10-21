// backend/middleware/auth.js
import { adminAuth } from "../firebaseAdmin.js";

export async function verifyAuth(req, res, next) {
  try {
    // אל תדרוש טוקן על OPTIONS (Preflight)
    if (req.method === "OPTIONS") {
      return next();
    }

    const header = String(req.headers.authorization || "").trim();
    // תומך גם ב- Bearer עם רווחים/רישיות שונות
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <token>" });
    }

    const idToken = m[1];
    const decoded = await adminAuth.verifyIdToken(idToken);

    // אפשר לשים רק מה שצריך על req.user
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || decoded.displayName || null,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

