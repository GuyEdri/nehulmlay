// frontend/src/components/UpdateStock.js
import React, { useState } from "react";
import { api } from "../api";

export default function UpdateStock({ productId, onUpdate }) {
  const [diff, setDiff] = useState("");        // קולט גם "-" בזמן ההקלדה
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateStock = async (e) => {
    if (e) e.preventDefault();
    setError("");

    // המרה בטוחה למספר שלם (מותר שלילי/חיובי, לא 0)
    const diffStr = String(diff).trim();
    if (diffStr === "") {
      setError("יש להזין שינוי מלאי (לדוגמה: 5 או -3)");
      return;
    }
    const diffNum = Number.parseInt(diffStr, 10);
    if (!Number.isFinite(diffNum) || diffNum === 0) {
      setError("השינוי חייב להיות מספר שלם שאינו 0");
      return;
    }

    if (!productId) {
      setError("חסר מזהה מוצר לעדכון");
      return;
    }

    try {
      setLoading(true);
      await api.put(`/api/products/${productId}/stock`, { diff: diffNum });
      setDiff("");
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err?.response?.data?.error || "שגיאה בעדכון מלאי");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={updateStock}
      style={{
        display: "flex",
        gap: "6px",
        direction: "rtl",
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <input
        type="number"
        value={diff}
        onChange={(e) => setDiff(e.target.value)}
        placeholder="+/-"
        step={1}
        style={{ width: "70px", textAlign: "right" }}
        disabled={loading}
      />
      <button type="submit" disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "מעדכן..." : "עדכן"}
      </button>
      {error && (
        <span style={{ color: "red", fontSize: 12, marginRight: 8 }}>{error}</span>
      )}
    </form>
  );
}

