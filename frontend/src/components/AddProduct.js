// frontend/src/components/AddProduct.js
import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function AddProduct({ onAdd }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState(""); // נשמר כטקסט כדי להימנע מ-NaN בזמן הקלדה

  // 👇 חדש: מחסנים ושיוך
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(""); // "" = ללא שיוך

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/warehouses");
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!mounted) return;
        setWarehouses([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanName = (name || "").trim();
    const cleanSku = (sku || "").trim().toUpperCase();
    const qty = Number(stock);

    if (!cleanName) {
      setError("יש להזין שם מוצר");
      return;
    }
    if (!cleanSku) {
      setError("יש להזין מקט (SKU)");
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      setError("כמות חייבת להיות מספר 0 ומעלה");
      return;
    }

    try {
      setLoading(true);
      const body = {
        name: cleanName,
        sku: cleanSku,
        description: (description || "").trim(),
        stock: qty,
      };
      if (warehouseId) body.warehouseId = warehouseId; // 👈 שליחה רק אם נבחר

      await api.post("/api/products", body);

      // איפוס טופס
      setName("");
      setSku("");
      setDescription("");
      setStock("");
      setWarehouseId(""); // איפוס שיוך
      setSuccess("המוצר נוסף בהצלחה");
      if (onAdd) onAdd();
    } catch (err) {
      setError(err?.response?.data?.error || "שגיאה בהוספת מוצר");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ maxWidth: 420, margin: "auto", direction: "rtl" }}
    >
      <h3 style={{ textAlign: "center" }}>הוספת מוצר חדש</h3>

      <input
        placeholder="שם מוצר"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 10,
          boxSizing: "border-box",
          textAlign: "right",
        }}
      />

      <input
        placeholder="מקט (SKU)"
        value={sku}
        onChange={(e) => setSku(e.target.value.toUpperCase())}
        required
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 10,
          boxSizing: "border-box",
          textAlign: "right",
          letterSpacing: 1,
          fontFamily: "monospace",
        }}
      />

      <input
        placeholder="תיאור (לא חובה)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 10,
          boxSizing: "border-box",
          textAlign: "right",
        }}
      />

      <input
        type="number"
        placeholder="כמות במלאי"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        min={0}
        step={1}
        required
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 10,
          boxSizing: "border-box",
          textAlign: "right",
        }}
      />

      {/* 👇 חדש: בחירת מחסן (רשות) */}
      <label style={{ display: "block", marginBottom: 6 }}>שיוך למחסן (רשות)</label>
      <select
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 12,
          boxSizing: "border-box",
          textAlign: "right",
        }}
      >
        <option value="">ללא שיוך</option>
        {warehouses.map((w) => (
          <option key={w._id || w.id} value={String(w._id || w.id)}>
            {w.name || "(ללא שם)"}{w.address ? ` — ${w.address}` : ""}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: 10,
          backgroundColor: loading ? "#90caf9" : "#1976d2",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "default" : "pointer",
          fontWeight: "bold",
        }}
      >
        {loading ? "שומר..." : "הוסף"}
      </button>

      {error && (
        <div style={{ color: "red", marginTop: 8, textAlign: "center" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: "green", marginTop: 8, textAlign: "center" }}>
          {success}
        </div>
      )}
    </form>
  );
}

