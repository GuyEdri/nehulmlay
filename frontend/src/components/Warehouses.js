// frontend/src/components/Warehouses.js
import React, { useEffect, useState } from "react";
import { api } from "../api";
import * as XLSX from "xlsx";

const styles = {
  container: {
    direction: "rtl",
    textAlign: "right",
    maxWidth: 900,
    margin: "0 auto",
    padding: "12px 12px 24px",
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
  title: { fontSize: 22, fontWeight: 700, margin: "0 0 12px", textAlign: "center" },
  subtitle: { fontSize: 18, fontWeight: 600, margin: "0 0 10px", textAlign: "center" },

  // form
  form: { display: "grid", gap: 10 },
  formRow: { display: "grid", gap: 6 },
  label: { fontSize: 14, fontWeight: 600 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    border: "1px solid #cbd5e1", borderRadius: 8, outline: "none",
    textAlign: "right", direction: "rtl", fontSize: 15,
  },
  textarea: {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    border: "1px solid #cbd5e1", borderRadius: 8, outline: "none",
    textAlign: "right", direction: "rtl", fontSize: 15, minHeight: 90, resize: "vertical",
  },
  btnRow: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  button: {
    appearance: "none", border: "none", background: "#1976d2", color: "#fff",
    padding: "12px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
    lineHeight: 1.1,
  },
  buttonGhost: {
    appearance: "none", border: "1px solid #cbd5e1", background: "#fff", color: "#111827",
    padding: "12px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
  },
  buttonSuccess: {
    appearance: "none", border: "none", background: "#16a34a", color: "#fff",
    padding: "12px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
  },
  buttonWarn: {
    appearance: "none", border: "none", background: "#eab308", color: "#111827",
    padding: "12px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
  },
  buttonExcel: {
    appearance: "none", border: "none", background: "#22c55e", color: "#fff",
    padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
  },
  buttonExcelAll: {
    appearance: "none", border: "none", background: "#10b981", color: "#fff",
    padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
  },

  // alerts
  alertError: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" },
  alertSuccess: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" },

  // table (desktop)
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", direction: "rtl" },
  th: { textAlign: "right", padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc", fontWeight: 700, whiteSpace: "nowrap", fontSize: 14 },
  td: { textAlign: "right", padding: "12px 16px", borderTop: "1px solid #f1f5f9", verticalAlign: "top", wordBreak: "break-word", fontSize: 14 },
  actionsCell: { textAlign: "left", padding: "12px 16px", borderTop: "1px solid #f1f5f9", whiteSpace: "nowrap" },

  // inline inputs
  tdInput: {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14,
    border: "1px solid #cbd5e1", borderRadius: 8, textAlign: "right", direction: "rtl",
  },
};

// CSS רספונסיבי למובייל — הופך טבלה לכרטיסים
const mobileCss = `
@media (max-width: 640px) {
  .rtable thead { display: none; }
  .rtable tr { display: block; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
  .rtable td, .rtable th { display: block; border: none !important; padding: 10px 12px !important; }
  .rtable td[data-label] { display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: start; }
  .rtable td[data-label]::before {
    content: attr(data-label);
    color: #6b7280;
    font-weight: 700;
    text-align: right;
  }
  .rtable td.actions { display: flex; gap: 8px; justify-content: stretch; }
  .rtable td.actions > button { flex: 1 1 50%; padding: 12px 10px; border-radius: 10px; }
  .btnFullMobile { width: 100%; }
  .formButtons { justify-content: center !important; }
  .title { font-size: 20px !important; }
  .subtitle { font-size: 16px !important; }
}
`;

function sanitizeSheetName(name) {
  if (!name) return "Sheet";
  const cleaned = String(name).replace(/[:\\/?*\[\]]/g, "_");
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
}

function formatNowSuffix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function formatDate(x) {
  try {
    const d = x ? new Date(x) : null;
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ name: "", address: "", notes: "" });

  // messages
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

  useEffect(() => { fetchWarehouses(); }, []);

  // create
  const onCreate = async (e) => {
    e?.preventDefault();
    setErr(""); setSuccess("");

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
      setName(""); setAddress(""); setNotes("");
      fetchWarehouses();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "שגיאה ביצירת מחסן");
    }
  };

  // edit flow
  const startEdit = (w) => {
    setEditingId(String(w._id || w.id));
    setEditFields({
      name: w.name || "",
      address: w.address || "",
      notes: w.notes || "",
    });
    setErr(""); setSuccess("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({ name: "", address: "", notes: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = {
      name: (editFields.name || "").trim(),
      address: (editFields.address || "").trim(),
      notes: (editFields.notes || "").trim(),
    };
    if (!payload.name) {
      setErr("שם המחסן אינו יכול להיות ריק");
      return;
    }
    try {
      await api.put(`/api/warehouses/${editingId}`, payload);
      setSuccess("המחסן עודכן בהצלחה");
      setEditingId(null);
      setEditFields({ name: "", address: "", notes: "" });
      fetchWarehouses();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "שגיאה בעדכון מחסן");
    }
  };

  // =======================
  // Excel Export: ITEMS per warehouse
  // =======================

  // המרת אובייקט פריט לשורה באקסל (בעברית + סדר עמודות)
  const itemToRow = (it) => {
    // תמיכה בשמות שדות שונים — שנה כאן לפי ה־API שלך במידת הצורך
    return {
      "SKU": it.sku ?? it.SKU ?? "",
      "שם פריט": it.name ?? it.itemName ?? "",
      "כמות": it.quantity ?? it.qty ?? 0,
      "יחידה": it.unit ?? it.uom ?? "",
      "מיקום במחסן": it.location ?? it.bin ?? "",
      "מינימום מלאי": it.minStock ?? it.minimum ?? "",
      "הערות": it.notes ?? "",
      "עודכן בתאריך": formatDate(it.updatedAt ?? it.updated_at ?? it.lastUpdated),
      "מזהה פריט": String(it.id ?? it._id ?? ""),
    };
  };

  const fetchItemsForWarehouse = async (wid) => {
    // מצפה ל: GET /api/warehouses/:id/items  ->  Array<item>
    const res = await api.get(`/api/warehouses/${wid}/items`);
    const items = Array.isArray(res.data) ? res.data : [];
    return items;
  };

  const exportWarehouseItems = async (w) => {
    try {
      const wid = String(w._id || w.id);
      const items = await fetchItemsForWarehouse(wid);

      const dataRows = items.length
        ? items.map(itemToRow)
        : [{ "SKU": "", "שם פריט": "אין פריטים", "כמות": "", "יחידה": "", "מיקום במחסן": "", "מינימום מלאי": "", "הערות": "", "עודכן בתאריך": "", "מזהה פריט": "" }];

      const ws = XLSX.utils.json_to_sheet(dataRows, { header: Object.keys(dataRows[0]) });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(w.name || "מחסן"));

      XLSX.writeFile(wb, `warehouse_items_${(w.name || "unnamed").trim() || "unnamed"}_${formatNowSuffix()}.xlsx`);
    } catch (e) {
      console.error("Export warehouse items failed:", e);
      setErr("שגיאה בייצוא תכולת המחסן");
    }
  };

  const exportAllWarehousesItemsMultiSheets = async () => {
    try {
      if (!Array.isArray(list) || list.length === 0) return;

      const wb = XLSX.utils.book_new();

      // טוען פריטים לכל מחסן ברצף (אפשר לשפר ל־Promise.all אם ה־API והדפדפן עומדים בזה)
      for (let idx = 0; idx < list.length; idx++) {
        const w = list[idx];
        const wid = String(w._id || w.id);
        let items = [];
        try {
          items = await fetchItemsForWarehouse(wid);
        } catch (e) {
          // אם יש שגיאה במחסן מסוים — נייצא גיליון ריק עם שורת שגיאה
          items = [];
        }

        const dataRows = items.length
          ? items.map(itemToRow)
          : [{ "SKU": "", "שם פריט": "אין פריטים", "כמות": "", "יחידה": "", "מיקום במחסן": "", "מינימום מלאי": "", "הערות": "", "עודכן בתאריך": "", "מזהה פריט": "" }];

        const ws = XLSX.utils.json_to_sheet(dataRows, { header: Object.keys(dataRows[0]) });
        const sheetName = sanitizeSheetName((w.name || `מחסן_${idx + 1}`).trim() || `מחסן_${idx + 1}`);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      XLSX.writeFile(wb, `warehouses_items_${formatNowSuffix()}.xlsx`);
    } catch (e) {
      console.error("Export all warehouses items failed:", e);
      setErr("שגיאה בייצוא תכולה של כל המחסנים");
    }
  };

  return (
    <div style={styles.container}>
      {/* CSS רספונסיבי למובייל */}
      <style>{mobileCss}</style>

      <h1 style={{ ...styles.title }} className="title">מחסנים</h1>

      {/* יצירת מחסן */}
      <div style={styles.card}>
        <h2 style={{ ...styles.subtitle }} className="subtitle">יצירת מחסן חדש</h2>
        <form onSubmit={onCreate} style={styles.form} dir="rtl">
          <div style={styles.formRow}>
            <label htmlFor="wh-name" style={styles.label}>שם מחסן *</label>
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
            <label htmlFor="wh-address" style={styles.label}>כתובת (רשות)</label>
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
            <label htmlFor="wh-notes" style={styles.label}>הערות (רשות)</label>
            <textarea
              id="wh-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={styles.textarea}
              placeholder="מידע נוסף"
            />
          </div>
          <div style={{ ...styles.btnRow }} className="formButtons">
            <button type="submit" style={{ ...styles.button }} className="btnFullMobile">
              צור מחסן
            </button>
          </div>
          {err && <div style={{ ...styles.alertError, marginTop: 8 }}>{err}</div>}
          {success && <div style={{ ...styles.alertSuccess, marginTop: 8 }}>{success}</div>}
        </form>
      </div>

      {/* רשימת מחסנים + ייצוא */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>רשימת מחסנים</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              title="ייצא קובץ אקסל: גיליון לכל מחסן עם התכולה"
              style={styles.buttonExcelAll}
              onClick={exportAllWarehousesItemsMultiSheets}
            >
              ייצוא תכולת כל המחסנים (גיליונות)
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>טוען…</div>
        ) : list.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>אין מחסנים עדיין</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table} className="rtable" dir="rtl">
              <thead>
                <tr>
                  <th style={styles.th}>שם</th>
                  <th style={styles.th}>כתובת</th>
                  <th style={styles.th}>הערות</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => {
                  const id = String(w._id || w.id);
                  const isEditing = editingId === id;
                  return (
                    <tr key={id}>
                      <td style={styles.td} data-label="שם">
                        {isEditing ? (
                          <input
                            style={styles.tdInput}
                            value={editFields.name}
                            onChange={(e) => setEditFields((s) => ({ ...s, name: e.target.value }))}
                          />
                        ) : (
                          w.name || "(ללא שם)"
                        )}
                      </td>
                      <td style={styles.td} data-label="כתובת">
                        {isEditing ? (
                          <input
                            style={styles.tdInput}
                            value={editFields.address}
                            onChange={(e) => setEditFields((s) => ({ ...s, address: e.target.value }))}
                          />
                        ) : (
                          w.address || "—"
                        )}
                      </td>
                      <td style={styles.td} data-label="הערות">
                        {isEditing ? (
                          <input
                            style={styles.tdInput}
                            value={editFields.notes}
                            onChange={(e) => setEditFields((s) => ({ ...s, notes: e.target.value }))}
                          />
                        ) : (
                          w.notes || "—"
                        )}
                      </td>
                      <td style={styles.actionsCell} className="actions" data-label="פעולות">
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-start", flexWrap: "wrap" }}>
                            <button type="button" style={styles.buttonSuccess} onClick={saveEdit}>שמור</button>
                            <button type="button" style={styles.buttonGhost} onClick={cancelEdit}>ביטול</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-start", flexWrap: "wrap" }}>
                            <button type="button" style={styles.buttonWarn} onClick={() => startEdit(w)}>ערוך</button>
                            <button
                              type="button"
                              style={styles.buttonExcel}
                              title="ייצא אקסל של תכולת המחסן"
                              onClick={() => exportWarehouseItems(w)}
                            >
                              ייצוא תכולה
                            </button>
                          </div>
                        )}
                      </td>
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
