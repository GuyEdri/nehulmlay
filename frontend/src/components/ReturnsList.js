// frontend/src/components/ReturnsList.js
import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function ReturnsList() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/returns");
        setReturns(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("GET /api/returns failed:", err);
        setError(err?.response?.data?.error || "שגיאה בטעינת זיכויים");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return <div style={{ textAlign: "center", marginTop: 40 }}>טוען זיכויים...</div>;

  if (error)
    return <div style={{ color: "red", textAlign: "center", marginTop: 40 }}>{error}</div>;

  if (returns.length === 0)
    return <div style={{ textAlign: "center", marginTop: 40 }}>אין זיכויים להצגה</div>;

  return (
    <div style={{ direction: "rtl", padding: 16 }}>
      <h3 style={{ textAlign: "center" }}>רשימת זיכויים</h3>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          maxWidth: 900,
          margin: "auto",
          background: "#fafafa",
        }}
      >
        <thead>
          <tr style={{ background: "#ddd" }}>
            <th style={thStyle}>#</th>
            <th style={thStyle}>תאריך</th>
            <th style={thStyle}>לקוח</th>
            <th style={thStyle}>מוצר/ים</th>
            <th style={thStyle}>מחסן</th>
            <th style={thStyle}>הוחזר ע״י</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((r, idx) => (
            <tr key={r.id || idx} style={{ borderBottom: "1px solid #ccc" }}>
              <td style={tdStyle}>{idx + 1}</td>
              <td style={tdStyle}>
                {r.date
                  ? new Date(r.date.seconds ? r.date.seconds * 1000 : r.date).toLocaleString("he-IL")
                  : ""}
              </td>
              <td style={tdStyle}>{r.customerName || "—"}</td>
              <td style={tdStyle}>
                {Array.isArray(r.items)
                  ? r.items.map((i) => `${i.name || i.sku || "מוצר"} × ${i.quantity}`).join(", ")
                  : "—"}
              </td>
              <td style={tdStyle}>{r.warehouseName || "—"}</td>
              <td style={tdStyle}>{r.issuedByName || r.issuedByEmail || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: "8px 12px",
  border: "1px solid #ccc",
  textAlign: "center",
};

const tdStyle = {
  padding: "6px 10px",
  border: "1px solid #ddd",
  textAlign: "center",
};

