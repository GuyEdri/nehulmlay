// frontend/src/components/UpdateStock.js
import React, { useState, useCallback } from "react";
import { api } from "../api";

export default function UpdateStock({ productId, onUpdate }) {
  const [diff, setDiff] = useState(""); // טקסט כדי לאפשר הקלדה של "-" לפני מספר
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applyUpdate = useCallback(
    async (delta) => {
      setError("");

      // אם הגיע delta מבחוץ (כפתורי + / -) — השתמש בו; אחרת קרא מהשדה
      const raw = typeof delta === "number" ? String(delta) : String(diff).trim();

      if (raw === "") {
        setError("יש להזין שינוי מלאי (לדוגמה: 5 או -3)");
        return;
      }

      // רק מספר שלם (לא 0)
      const num = Number.parseInt(raw, 10);
      if (!Number.isFinite(num) || num === 0) {
        setError("השינוי חייב להיות מספר שלם שאינו 0");
        return;
      }

      if (!productId) {
        setError("חסר מזהה מוצר לעדכון");
        return;
      }

      try {
        setLoading(true);
        await api.put(`/api/products/${productId}/stock`, { diff: num });
        setDiff("");
        onUpdate && onUpdate();
      } catch (err) {
        setError(err?.response?.data?.error || "שגיאה בעדכון מלאי");
      } finally {
        setLoading(false);
      }
    },
    [diff, productId, onUpdate]
  );

  const onSubmit = (e) => {
    e.preventDefault();
    applyUpdate();
  };

  const nudge = (amount) => {
    // כפתורי + / −: שולחים עדכון מיידי
    if (loading) return;
    applyUpdate(amount);
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: 6,
        direction: "rtl",
        justifyContent: "flex-end",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => nudge(-1)}
        disabled={loading}
        aria-label="הפחת אחד"
        title="הפחת אחד"
        style={{ padding: "6px 10px" }}
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        value={diff}
        onChange={(e) => setDiff(e.target.value)}
        placeholder="+/-"
        step={1}
        style={{ width: 80, textAlign: "right" }}
        disabled={loading}
        // מונע גלילת עכבר שמשנה ערך בטעות
        onWheel={(e) => e.currentTarget.blur()}
        // Enter שולח את הטופס
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyUpdate();
          }
        }}
        // על יציאה מהשדה — נרמול קל: אם נשאר "-" בלבד, ננקה
        onBlur={() => {
          if (diff.trim() === "-") setDiff("");
        }}
      />

      <button
        type="button"
        onClick={() => nudge(1)}
        disabled={loading}
        aria-label="הוסף אחד"
        title="הוסף אחד"
        style={{ padding: "6px 10px" }}
      >
        +
      </button>

      <button type="submit" disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "מעדכן..." : "עדכן"}
      </button>

      {error && (
        <span style={{ color: "red", fontSize: 12, marginRight: 8 }}>{error}</span>
      )}
    </form>
  );
}

