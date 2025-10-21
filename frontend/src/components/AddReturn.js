// frontend/src/components/AddReturn.js
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

/**
 * טופס יצירת זיכוי (החזרת מוצרים למחסן יעד)
 * שולח ל: POST /api/returns
 * שדות: warehouseId, customer, customerName, returnedBy, items[], signature?, date?, personalNumber?, notes
 */
export default function AddReturn({ onCreated }) {
  // מחסנים + בחירה
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [whLoading, setWhLoading] = useState(true);

  // לקוחות + בחירה
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState(""); // נשמר גם טקסטואלית, כמו אצלך בניפוק
  const [customersLoading, setCustomersLoading] = useState(true);

  // פרטים כלליים
  const [returnedBy, setReturnedBy] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16)); // datetime-local

  // פריטי זיכוי
  const [rows, setRows] = useState([
    { productId: "", productLabel: "", quantity: "", searchTerm: "", suggestions: [], searching: false, stock: null, sku: "" },
  ]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ============== טעינה ראשונית: מחסנים + לקוחות ==============
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setWhLoading(true);
        const res = await api.get("/api/warehouses");
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setWarehouses(list);
      } catch (e) {
        console.error("GET /api/warehouses failed:", e?.response?.data || e?.message);
        if (mounted) setWarehouses([]);
      } finally {
        if (mounted) setWhLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCustomersLoading(true);
        const res = await api.get("/api/customers");
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        // סידור לפי שם
        list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he"));
        setCustomers(list);
      } catch (e) {
        console.error("GET /api/customers failed:", e?.response?.data || e?.message);
        if (mounted) setCustomers([]);
      } finally {
        if (mounted) setCustomersLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ============== חיפוש מוצרים בכל שורה ==============
  const searchProducts = async (idx, term) => {
    setRows(prev => {
      const next = [...prev];
      next[idx].searching = true;
      next[idx].searchTerm = term;
      return next;
    });
    try {
      const params = { search: term };
      // אם נבחר מחסן יעד — עדיף לחפש רק בו כדי להציג מלאי רלוונטי
      if (warehouseId) params.warehouseId = warehouseId;
      const res = await api.get("/api/products", { params });
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(prev => {
        const next = [...prev];
        if (!next[idx]) return prev;
        next[idx].suggestions = list.slice(0, 10); // לא להעמיס
        return next;
      });
    } catch (e) {
      console.error("GET /api/products search failed:", e?.response?.data || e?.message);
      setRows(prev => {
        const next = [...prev];
        if (!next[idx]) return prev;
        next[idx].suggestions = [];
        return next;
      });
    } finally {
      setRows(prev => {
        const next = [...prev];
        if (!next[idx]) return prev;
        next[idx].searching = false;
        return next;
      });
    }
  };

  const onPickSuggestion = (idx, product) => {
    setRows(prev => {
      const next = [...prev];
      if (!next[idx]) return prev;
      const label = `${product.name || "(ללא שם)"} - ${product.sku || ""}`;
      next[idx] = {
        ...next[idx],
        productId: product.id || product._id,
        productLabel: label,
        searchTerm: label,
        suggestions: [],
        stock: product.stock ?? null,
        sku: product.sku || "",
      };
      // אם אין כמות — ברירת מחדל 1
      if (!next[idx].quantity) next[idx].quantity = "1";
      return next;
    });
  };

  // ============== ניהול שורות ==============
  const addRow = () => {
    setRows(prev => [...prev, { productId: "", productLabel: "", quantity: "", searchTerm: "", suggestions: [], searching: false, stock: null, sku: "" }]);
  };
  const removeRow = (idx) => {
    setRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  // ============== שליחה ==============
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // ולידציה בסיסית
    if (!customerId || !customerName) return setErrorMsg("בחר לקוח והזן שם לקוח");
    if (!returnedBy.trim()) return setErrorMsg("יש להזין מי החזיר");
    const items = rows
      .map(r => ({ product: r.productId, quantity: Number(r.quantity) }))
      .filter(it => it.product && Number.isFinite(it.quantity) && it.quantity > 0);
    if (items.length === 0) return setErrorMsg("הוסף לפחות פריט אחד עם כמות תקינה");

    try {
      setLoading(true);
      const body = {
        warehouseId: String(warehouseId || "").trim(), // יעד (רשות)
        customer: String(customerId),
        customerName: String(customerName).trim(),
        returnedBy: String(returnedBy).trim(),
        items,
        // signature: dataUrlIfYouHaveOne,
        date: date ? new Date(date).toISOString() : undefined,
        personalNumber: personalNumber ? String(personalNumber) : "",
        notes: String(notes || ""),
      };
      const res = await api.post("/api/returns", body);
      setSuccessMsg("הזיכוי נשמר בהצלחה ✅");
      // איפוס טופס
      setWarehouseId("");
      setCustomerId("");
      setCustomerName("");
      setReturnedBy("");
      setPersonalNumber("");
      setNotes("");
      setDate(new Date().toISOString().slice(0, 16));
      setRows([{ productId: "", productLabel: "", quantity: "", searchTerm: "", suggestions: [], searching: false, stock: null, sku: "" }]);
      if (onCreated) onCreated(res.data);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || "שגיאה בשמירת הזיכוי");
    } finally {
      setLoading(false);
    }
  };

  // נגזרת להצגת שם לקוח לפי בחירה
  const selectedCustomerNameFromList = useMemo(() => {
    const c = customers.find(c => String(c.id || c._id) === String(customerId));
    return c?.name || "";
  }, [customers, customerId]);

  useEffect(() => {
    // אם בחרת מה־select של לקוחות — נעדכן גם את שדה השם
    if (selectedCustomerNameFromList && !customerName) {
      setCustomerName(selectedCustomerNameFromList);
    }
  }, [selectedCustomerNameFromList]); // eslint-disable-line

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "auto", direction: "rtl" }}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>יצירת זיכוי (החזרת מוצרים)</h2>

      {/* מחסן יעד */}
      <label style={{ display: "block", marginBottom: 6 }}>מחסן יעד (רשות)</label>
      {whLoading ? (
        <div style={{ marginBottom: 12 }}>טוען מחסנים…</div>
      ) : warehouses.length === 0 ? (
        <div style={{ marginBottom: 12, color: "#777" }}>אין מחסנים להצגה</div>
      ) : (
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right" }}
        >
          <option value="">בחר מחסן יעד (לא חובה)</option>
          {warehouses.map((w) => (
            <option key={w._id || w.id} value={String(w._id || w.id)}>
              {w.name || "(ללא שם)"}{w.address ? ` — ${w.address}` : ""}
            </option>
          ))}
        </select>
      )}

      {/* לקוח */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>בחר לקוח</label>
          {customersLoading ? (
            <div style={{ marginBottom: 12 }}>טוען לקוחות…</div>
          ) : (
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right" }}
            >
              <option value="">בחר לקוח…</option>
              {customers.map((c) => (
                <option key={c._id || c.id} value={String(c._id || c.id)}>
                  {c.name || "(ללא שם)"}{c.phone ? ` — ${c.phone}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>שם לקוח (תצוגה במסמך)</label>
          <input
            placeholder="שם לקוח להצגה"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right" }}
          />
        </div>
      </div>

      {/* מי החזיר + מספר אישי */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>מי החזיר</label>
          <input
            placeholder="הכנס שם מחזיר"
            value={returnedBy}
            onChange={(e) => setReturnedBy(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>מספר אישי (רשות)</label>
          <input
            placeholder="למשל: 123456"
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right" }}
          />
        </div>
      </div>

      {/* תאריך */}
      <div>
        <label style={{ display: "block", marginBottom: 6 }}>תאריך ושעה</label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right" }}
        />
      </div>

      {/* הערות */}
      <div>
        <label style={{ display: "block", marginBottom: 6 }}>הערות (רשות)</label>
        <textarea
          placeholder="פרטים נוספים על ההחזרה…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: 8, marginBottom: 12, textAlign: "right", resize: "vertical" }}
        />
      </div>

      {/* טבלת פריטים */}
      <h3 style={{ marginTop: 8, marginBottom: 8 }}>פריטים להחזרה</h3>
      {rows.map((row, idx) => (
        <div key={idx} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr auto", gap: 8, alignItems: "start" }}>
            {/* חיפוש מוצר */}
            <div>
              <input
                placeholder="חפש מוצר לפי שם/מקט…"
                value={row.searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setRows(prev => {
                    const next = [...prev];
                    next[idx].searchTerm = val;
                    return next;
                  });
                  if ((val || "").trim().length >= 2) {
                    // דיליי קצר כדי לא להציף שרת
                    if (searchTimers[idx]) clearTimeout(searchTimers[idx]);
                    searchTimers[idx] = setTimeout(() => searchProducts(idx, val.trim()), 250);
                  } else {
                    setRows(prev => {
                      const next = [...prev];
                      next[idx].suggestions = [];
                      return next;
                    });
                  }
                }}
                style={{ width: "100%", padding: 8, marginBottom: 6, textAlign: "right" }}
              />
              {/* הצעות */}
              {row.suggestions.length > 0 && (
                <div style={{ border: "1px solid #ccc", borderRadius: 4, maxHeight: 160, overflowY: "auto" }}>
                  {row.suggestions.map((p) => (
                    <div
                      key={p._id || p.id}
                      onClick={() => onPickSuggestion(idx, p)}
                      style={{ padding: "6px 8px", cursor: "pointer" }}
                    >
                      <div style={{ fontWeight: 600, textAlign: "right" }}>{p.name || "(ללא שם)"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.8, textAlign: "right" }}>
                        {p.sku} • מלאי: {Number(p.stock ?? 0)}
                        {p.warehouseName ? ` • מחסן: ${p.warehouseName}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* כמות */}
            <div>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="כמות"
                value={row.quantity}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows(prev => {
                    const next = [...prev];
                    next[idx].quantity = v;
                    return next;
                  });
                }}
                style={{ width: "100%", padding: 8, textAlign: "right" }}
              />
              {row.stock != null && (
                <div style={{ fontSize: 12, color: "#555", marginTop: 4, textAlign: "right" }}>
                  מלאי נוכחי: {row.stock}
                </div>
              )}
            </div>

            {/* הסרה */}
            <div>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={rows.length === 1}
                style={{
                  padding: "8px 10px",
                  background: rows.length === 1 ? "#eee" : "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                הסר
              </button>
            </div>
          </div>

          {/* פידבק בחירת מוצר */}
          {row.productId && (
            <div style={{ marginTop: 6, fontSize: 13, textAlign: "right", color: "#333" }}>
              נבחר: <b>{row.productLabel}</b>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={addRow}
          style={{
            padding: "10px 14px",
            background: "#eeeeee",
            color: "#333",
            border: "1px solid #ddd",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          + הוסף פריט
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", padding: 12,
          backgroundColor: loading ? "#90caf9" : "#1976d2",
          color: "white", border: "none", borderRadius: 4, fontWeight: "bold", fontSize: 16
        }}
      >
        {loading ? "שומר..." : "שמור זיכוי"}
      </button>

      {errorMsg && <div style={{ color: "red", marginTop: 10, textAlign: "center" }}>{errorMsg}</div>}
      {successMsg && <div style={{ color: "green", marginTop: 10, textAlign: "center" }}>{successMsg}</div>}
    </form>
  );
}

// דיליי קטן לחיפושים (debounce per-row)
const searchTimers = {};

