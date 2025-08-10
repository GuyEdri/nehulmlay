// backend/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import customersRouter from "./routes/customers.js";
import productsRouter from "./routes/products.js";
import deliveriesRouter from "./routes/deliveries.js";
import { verifyAuth } from "./middleware/auth.js";

const app = express();

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- Middleware -----

// הגדלת ה-limit בגלל חתימות base64
app.use(express.json({ limit: "5mb" }));

// CORS: מקורות מותרים מתוך משתנה סביבה או ברירות מחדל ל־localhost/Render
const defaultWhitelist = [
  /^http:\/\/localhost:\d+$/, // dev
  /\.onrender\.com$/,         // Render
];

const envWhitelist = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const whitelist = [
  ...envWhitelist,     // מחרוזות מלאות מ-FRONTEND_URL (אפשר כמה, מופרדים בפסיק)
  ...defaultWhitelist, // רג׳אקסים
];

app.use(
  cors({
    origin(origin, cb) {
      // מאפשר גם כלים ללא Origin (curl/Postman/Render health checks)
      if (!origin) return cb(null, true);
      const ok = whitelist.some((rule) =>
        typeof rule === "string" ? rule === origin : rule.test(origin)
      );
      return ok ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// (אופציונלי) סטטי – אם תרצה לשרת פונטים/קבצים:
app.use("/static", express.static(path.resolve(__dirname, "public")));

// ----- Public routes (ללא אימות) -----
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));
app.get("/", (req, res) => res.status(200).send("UGDA98 backend is up"));

// ----- Auth guard לכל REST API -----
app.use("/api", verifyAuth);

// ----- Protected API routes -----
app.use("/api/customers", customersRouter);
app.use("/api/products", productsRouter);
app.use("/api/deliveries", deliveriesRouter);

// 404 גנרי ל-API מוגן
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not Found" });
  }
  next();
});

// טיפול שגיאות בסיסי
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// ----- Start -----
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

