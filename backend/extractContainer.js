// backend/backfillContainers.js
import { db } from "./firebaseAdmin.js"; // משתמש באותו אתחול שקיים באפליקציה

// פונקציה לחילוץ שם מכולה מהתיאור
function extractContainer(description = "") {
  if (!description || typeof description !== "string") return "ללא מכולה";
  const text = description.trim();

  const patterns = [
    /מכולה[:\-\s]*([A-Za-z0-9א-ת]+)\b/i,
    /קונטיינר[:\-\s]*([A-Za-z0-9א-ת]+)\b/i,
    /\[(?:מכולה|קונטיינר)\s*:\s*([A-Za-z0-9א-ת]+)\]/i,
    /container[:\-\s]*([A-Za-z0-9\-]+)\b/i,
    /\[(?:container|cnt)\s*:\s*([A-Za-z0-9\-]+)\]/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return String(m[1]).toUpperCase();
  }
  return "ללא מכולה";
}

const PRODUCTS = "products";

(async () => {
  try {
    const snap = await db.collection(PRODUCTS).get();
    let updated = 0;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const current = (data.container || "").toString().trim();
      const fromDesc = extractContainer(data.description || "");

      if (!current && fromDesc && fromDesc !== "ללא מכולה") {
        await doc.ref.update({ container: fromDesc });
        updated++;
      }
    }

    console.log(`✅ Backfill done. Updated ${updated} products.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  }
})();

