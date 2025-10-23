// frontend/src/components/Warehouses.js
import React, { useEffect, useState } from "react";
import { api } from "../api";

const styles = {
  container: {
    direction: "rtl",
    textAlign: "right",
    maxWidth: 900,
    margin: "0 auto",
    padding: 16,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 16px",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: "0 0 12px",
    textAlign: "center",
  },
  form: {
    display: "grid",
    gap: 12,
  },
  formRow: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    outline: "none",
    textAlign: "right",
    direction: "rtl",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    outline: "none",
    textAlign: "right",
    direction: "rtl",
    fontSize: 14,
    minHeight: 80,
    resize: "vertical",
  },
  btnRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  button: {
    appearance: "none",
    border: "none",
    background: "#1976d2",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 6,
    fontWeight: 700,
    cursor: "pointer",
  },
  alertError: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 6,
    padding: "10px 12px",
  },
  alertSuccess: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 6,
    padding: "10px 12px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    direction: "rtl",
  },
  th: {
    textAlign: "right",
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  td: {
    textAlign: "right",
    padding: "12px 16px",
    borderTop: "1px solid #f1f5f9",
    verticalAlign: "top",
    wordBreak: "break-word",
  },
  mutedCenter: {
    color: "#6b7280",
    textAlign: "center",
    padding: 24,
  },
};

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // שדות הטופס
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/warehouses");
      setList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const onCreate = async (e) => {
    e?.preventDefault();
    setErr("");
    setSuccess("");

    const cleanName = (name || "").trim();
    if (!cleanName) {
      setErr("יש להזין שם מחסן");
      return;
    }

    try {
      await api.post("/api/warehouses", {
        name: cleanName,
        address: (address || "").trim(),
        notes: (notes || "").trim(),
      });
      setSuccess("המחסן נוצר בהצלחה");
      setName("");
      setAddress("");
      setNotes("");
      fetchWarehouses();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "שגיאה ביצירת מחסן");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>מחסנים</h1>

      {/* טופס יצירת מחסן */}
      <div style={styles.card}>
        <h2 style={styles.subtitle}>יצירת מחסן חדש</h2>

        <form onSubmit={onCreate} style={styles.form} dir="rtl">
          <div style={styles.formRow}>
            <label htmlFor="wh-name" style={styles.label}>
              שם מחסן *
            </label>
            <input
              id="wh-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              placeholder="לדוגמה: מחסן מרכזי"
              required
            />
          </div>

          <div style={styles.formRow}>
            <label htmlFor="wh-address" style={styles.label}>
              כתובת (רשות)
            </label>
            <input
              id="wh-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={styles.input}
              placeholder="כתובת המחסן"
            />
          </div>

          <div style={styles.formRow}>
            <label htmlFor="wh-notes" style={styles.label}>
              הערות (רשות)
            </label>
            <textarea
              id="wh-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={styles.textarea}
              placeholder="מידע נוסף"
            />
          </div>

          <div style={styles.btnRow}>
            <button type="submit" style={styles.button}>צור מחסן</button>
          </div>

          {err && <div style={styles.alertError}>{err}</div>}
          {success && <div style={styles.alertSuccess}>{success}</div>}
        </form>
      </div>

      {/* רשימת מחסנים */}
      <div style={styles.card}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>רשימת מחסנים</div>

        {loading ? (
          <div style={styles.mutedCenter}>טוען…</div>
        ) : list.length === 0 ? (
          <div style={styles.mutedCenter}>אין מחסנים עדיין</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table} dir="rtl">
              <thead>
                <tr>
                  <th style={styles.th}>שם</th>
                  <th style={styles.th}>כתובת</th>
                  <th style={styles.th}>הערות</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => {
                  const id = String(w._id || w.id);
                  return (
                    <tr key={id}>
                      <td style={styles.td}>{w.name || "(ללא שם)"}</td>
                      <td style={styles.td}>{w.address || "—"}</td>
                      <td style={styles.td}>{w.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
