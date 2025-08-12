// frontend/src/components/UpdateStock.js
import React, { useState } from "react";
import { api } from "../api";

/**
 * עדכון מלאי כערך מוחלט (כמות חדשה), ללא כפתורי +/-.
 * מחשב diff = newStock - currentStock ושולח לראוט הקיים שמקבל diff.
 *
 * props:
 * - productId (String)       מזהה מוצר
 * - currentStock (Number)    המלאי הנוכחי (נדרש לחישוב diff)
 * - onUpdate (Function)      קולבק לרענון הרשימה לאחר עדכון
 */
export default function UpdateStock({ productId, currentStock = 0, onUpdate }) {
  const [newQty, setNewQty] = useState(""); // כמות חדשה מוחלטת
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");

    // ולידציה
    if (newQty === "") {
      setError("יש להזין כמות חדשה");
      return;
    }
    const newVal = Number(newQty);
    if (!Number.isFinite(newVal) || newVal < 0 || !Number.isInteger(newVal)) {
      setError("הכמות חייבת להיות מספר שלם 0 ומעלה");
      return;
    }
    if (!productId) {
      setError("חסר מזהה מוצר");
      return;
    }

    // חישוב diff ושליחה לשרת
    const diff = newVal - Number(currentStock || 0);
    if (diff === 0) {
      setError("הכמות החדשה זהה למלאי הנוכחי");
      return;
    }

    try {
      setLoading(true);
      await api.put(`/api/products/${productId}/stock`, { diff });
      setNewQty("");
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err?.response?.data?.error || "שגיאה בעדכון מלאי");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: 8,
        direction: "rtl",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12, color: "#555" }}>
        נוכחי: <b>{Number(currentStock ?? 0)}</b>
      </span>

      <input
        type="number"
        min={0}
        step={1}
        value={newQty}
        onChange={(e) => setNewQty(e.target.value)}
        placeholder="כמות חדשה"
        style={{
          width: 110,
          textAlign: "right",
          padding: "6px 8px",
          boxSizing: "border-box",
        }}
        disabled={loading}
      />

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "6px 12px",
          background: loading ? "#9e9e9e" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "מעדכן..." : "עדכן"}
      </button>

      {error && (
        <span style={{ color: "red", fontSize: 12 }}>{error}</span>
      )}
    </form>
  );
}

