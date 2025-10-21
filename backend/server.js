// backend/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import customersRouter from "./routes/customers.js";
import productsRouter from "./routes/products.js";
import deliveriesRouter from "./routes/deliveries.js";
import warehousesRouter from "./routes/warehouses.js";
import returnsRouter from "./routes/returns.js"; // ← זיכויים

// Middleware
import { verifyAuth } from "./middleware/auth.js";

const app = express();

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Render/Heroku proxy
app.set("trust proxy", 1);

// ----- Middleware -----
app.use(express.json({ limit: "10mb" })); // חתימות/PDF

// CORS whitelist
const defaultWhitelist = [
  /^http:\/\/localhost:\d+$/, // dev
  /\.onrender\.com$/,         // Render
];

const envWhitelist = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const whitelist = [...envWhitelist, ...defaultWhitelist];

const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // מאפשר CLI/health
    const ok = whitelist.some((rule) =>
      typeof rule === "string" ? rule === origin : rule.test(origin)
    );
    return ok ? cb(null, true) : cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
});

app.use(corsMiddleware);

// סטטי (אופציונלי)
app.use("/static", express.static(path.resolve(__dirname, "public")));

// ----- Public routes -----
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));
app.get("/", (req, res) => res.status(200).send("UGDA98 backend is up"));

// 👇 חשוב: לאשר Preflight לכל נתיבי /api (Express 5-compatible)
app.options(/^\/api\/.*$/, corsMiddleware);

// ----- Auth guard -----
app.use("/api", verifyAuth);

// ----- Protected API routes -----
app.use("/api/customers", customersRouter);
app.use("/api/products", productsRouter);
app.use("/api/deliveries", deliveriesRouter);
app.use("/api/warehouses", warehousesRouter);
app.use("/api/returns", returnsRouter);

// 404 לנתיבי API
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not Found" });
  }
  next();
});

// Error handler
app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS: origin not allowed" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});

// ----- Start -----
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

