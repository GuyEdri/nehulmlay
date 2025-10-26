// frontend/src/components/AddReturn.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import { api } from "../api";

/* ======== סגנונות בסיס (כולל קומבו־בוקס) ======== */
const styles = {
  root: { maxWidth: 820, margin: "auto", direction: "rtl", textAlign: "right", fontFamily: "Arial, sans-serif" },
  section: { marginBottom: 10 },
  label: { display: "block", fontWeight: 700, marginBottom: 4 },
  input: { width: "100%", padding: 8, textAlign: "right", boxSizing: "border-box" },
  select: { width: "100%", padding: 8, textAlign: "right", boxSizing: "border-box", background: "#fff" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  itemBox: { border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 10 },

  // combobox
  comboWrap: { position: "relative" },
  comboInput: {
    width: "100%", padding: "12px 14px", border: "1px solid #cbd5e1",
    borderRadius: 10, outline: "none", fontSize: 15, textAlign: "right", direction: "rtl",
  },
  comboList: {
    position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)",
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)", zIndex: 50, maxHeight: 280, overflowY: "auto",
  },
  comboItem: { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" },
  comboItemMuted: { color: "#6b7280", fontSize: 12 },
  chipChosen: { fontSize: 12, color: "#444", marginTop: 4, textAlign: "right" },
};

/* ======== קומבו־בוקס בחירת מוצר (חיפוש + הצעות) ======== */
function SearchableProductSelect({
  value,              // productId (string) או "" אם לא נבחר
  searchTerm,         // מחרוזת לחיפוש/תצוגה
  onSearch,           // (text) => void
  onPick,             // (productObj) => void
  fetcher,            // async (q) => products[]
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [suggests, setSuggests] = useState([]);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // הבאת הצעות עם debounce
  useEffect(() => {
    if (disabled) return;
    const q = (searchTerm || "").trim();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (q.length < 2) {
      setSuggests([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const list = await fetcher(q);
        setSuggests(Array.isArray(list) ? list.slice(0, 30) : []);
      } catch {
        setSuggests([]);
      }
    }, 250);
  }, [searchTerm, disabled, fetcher]);

  return (
    <div style={styles.comboWrap} ref={wrapRef} dir="rtl">
      <input
        style={styles.comboInput}
        placeholder="חפש מוצר לפי שם/מקט…"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        onFocus={() => !disabled && setOpen(true)}
        disabled={disabled}
      />
      {open && !disabled && (
        <div style={styles.comboList}>
          {suggests.length === 0 ? (
            <div style={{ ...styles.comboItem, ...styles.comboItemMuted }}>
              {searchTerm?.trim()?.length < 2 ? "הקלד לפחות 2 תווים…" : "לא נמצאו תוצאות"}
            </div>
          ) : (
            suggests.map((p) => {
              const id = String(p._id || p.id);
              return (
                <div
                  key={id}
                  style={styles.comboItem}
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name || "(ללא שם)"}</div>
                  <div style={styles.comboItemMuted}>
                    {p.sku ? `מקט: ${p.sku}` : "ללא מקט"}{p.warehouseName ? ` · מחסן: ${p.warehouseName}` : ""}
                    {Number.isFinite(Number(p.stock)) ? ` · מלאי: ${p.stock}` : ""}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function AddReturn({ onCreated, prefill }) {
  // מצב כללי/שגיאות
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // מחסנים + בחירת יעד
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");

  // לקוחות + בחירה
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");

  // מי החזיר, תאריך, מספר אישי והערות
  const [returnedBy, setReturnedBy] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16)); // input[type=datetime-local]
  const [personalNumber, setPersonalNumber] = useState("");
  const [notes, setNotes] = useState("");

  // שורות פריטים לזיכוי
  // row: { productId, productLabel, searchTerm, quantity, manualSku, manualName }
  const [rows, setRows] = useState([
    { productId: "", productLabel: "", searchTerm: "", quantity: 1, manualSku: "", manualName: "" },
  ]);

  // חתימה
  const [signature, setSignature] = useState("");
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  // האם הוחל prefill כבר
  const prefillAppliedRef = useRef(false);

  // --- טעינת מחסנים/לקוחות ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [whRes, custRes] = await Promise.all([
          api.get("/api/warehouses"),
          api.get("/api/customers"),
        ]);
        if (!mounted) return;
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
        setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
      } catch {
        if (!mounted) return;
        setWarehouses([]);
        setCustomers([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // אם נבחר לקוח — נעדכן גם שם (כדי לשמור תאום בין id ↔ name)
  useEffect(() => {
    if (!customerId) return setCustomerName("");
    const c = customers.find((x) => String(x.id || x._id) === String(customerId));
    setCustomerName(c?.name || "");
  }, [customerId, customers]);

  // --- החלת PRE-FILL אחרי שהנתונים נטענו (חד-פעמי) ---
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (!prefill) return;
    const warehousesReady = Array.isArray(warehouses);
    const customersReady = Array.isArray(customers);
    if (!warehousesReady || !customersReady) return;

    if (prefill.warehouseId !== undefined) setWarehouseId(String(prefill.warehouseId || ""));
    if (prefill.customerId !== undefined) setCustomerId(String(prefill.customerId || ""));
    if (prefill.customerName !== undefined) setCustomerName(String(prefill.customerName || ""));
    if (prefill.returnedBy !== undefined) setReturnedBy(String(prefill.returnedBy || ""));
    if (prefill.date !== undefined) setDate(prefill.date || new Date().toISOString().slice(0, 16));
    if (prefill.personalNumber !== undefined) setPersonalNumber(String(prefill.personalNumber || ""));
    if (prefill.notes !== undefined) setNotes(String(prefill.notes || ""));

    if (Array.isArray(prefill.rows) && prefill.rows.length > 0) {
      setRows(
        prefill.rows.map((r) => ({
          productId: String(r.productId || ""),
          productLabel: String(r.productLabel || ""),
          searchTerm: String(r.searchTerm || r.productLabel || ""),
          quantity: Number(r.quantity || 1),
          manualSku: String(r.manualSku || ""),
          manualName: String(r.manualName || ""),
        }))
      );
    }

    prefillAppliedRef.current = true;
  }, [prefill, warehouses, customers]);

  /* ======== חיפוש מוצרים ל־קומבו־בוקס (מביא מהשרת) ======== */
  const fetchProducts = useMemo(() => {
    return async (q) => {
      const res = await api.get(`/api/products?search=${encodeURIComponent(q)}`);
      return Array.isArray(res.data) ? res.data : [];
    };
  }, []);

  /* ======== פעולות על שורות ======== */
  const addRow = () =>
    setRows((prev) => [...prev, { productId: "", productLabel: "", searchTerm: "", quantity: 1, manualSku: "", manualName: "" }]);

  const removeRow = (idx) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  /* ======== חתימה על קנבס ======== */
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const x = (touch?.clientX ?? e.clientX) - rect.left;
    const y = (touch?.clientY ?? e.clientY) - rect.top;
    return { x, y };
  };
  const startDraw = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => {
    drawing.current = false;
    if (canvasRef.current) setSignature(canvasRef.current.toDataURL("image/png"));
  };
  const clearSignature = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    setSignature("");
  };

  /* ======== שליחה ======== */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!customerId || !customerName) return setErrorMsg("יש לבחור לקוח");
    if (!returnedBy.trim()) return setErrorMsg("יש למלא 'הוחזר ע\"י'");
    if (!Array.isArray(rows) || rows.length === 0) return setErrorMsg("יש להוסיף לפחות פריט אחד");

    const itemsToSend = [];
    for (const r of rows) {
      const qty = Number(r.quantity);
      if (!Number.isFinite(qty) || qty < 1) return setErrorMsg("כמות חייבת להיות מספר חיובי בכל פריט");

      if (r.productId) {
        itemsToSend.push({ product: String(r.productId), quantity: qty });
      } else if ((r.manualSku || "").trim()) {
        itemsToSend.push({
          sku: String(r.manualSku).trim().toUpperCase(),
          name: String(r.manualName || "").trim(),
          quantity: qty,
        });
      } else {
        return setErrorMsg("כל פריט חייב להיות בחירה מרשימה או להכניס SKU ידני");
      }
    }

    const hasManual = itemsToSend.some((it) => it.sku && !it.product);
    if (hasManual && !String(warehouseId || "").trim()) {
      return setErrorMsg("יש לבחור מחסן יעד עבור פריטים ידניים (SKU)");
    }

    try {
      setLoading(true);
      const body = {
        warehouseId: String(warehouseId || "").trim(),
        customer: String(customerId),
        customerName: String(customerName).trim(),
        returnedBy: String(returnedBy).trim(),
        items: itemsToSend,
        date: date ? new Date(date).toISOString() : undefined,
        personalNumber: personalNumber ? String(personalNumber) : "",
        notes: String(notes || ""),
        ...(signature ? { signature } : {}),
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
      setRows([{ productId: "", productLabel: "", searchTerm: "", quantity: 1, manualSku: "", manualName: "" }]);
      clearSignature();

      if (onCreated) onCreated(res.data);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || "שגיאה בשמירת הזיכוי");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.root}>
      <h2 style={{ textAlign: "center" }}>זיכוי מלאי</h2>

      {/* מחסן יעד */}
      <div style={styles.section}>
        <label style={styles.label}>מחסן יעד</label>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          style={styles.select}
        >
          <option value="">בחר… (רשות; חובה לפריטים ידניים)</option>
          {warehouses.map((w) => (
            <option key={w.id || w._id} value={String(w.id || w._id)}>
              {w.name || "(ללא שם)"}{w.address ? ` — ${w.address}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* לקוח + מי החזיר + תאריך + מס' אישי */}
      <div style={{ ...styles.section, ...styles.row2 }}>
        <div>
          <label style={styles.label}>לקוח</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={styles.select}
            required
          >
            <option value="">בחר לקוח…</option>
            {customers.map((c) => (
              <option key={c.id || c._id} value={String(c.id || c._id)}>
                {c.name || "(ללא שם)"}{c.phone ? ` — ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.label}>הוחזר ע״י</label>
          <input
            value={returnedBy}
            onChange={(e) => setReturnedBy(e.target.value)}
            placeholder="שם המוסר"
            style={styles.input}
            required
          />
        </div>

        <div>
          <label style={styles.label}>תאריך ושעה</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.input}
          />
        </div>

        <div>
          <label style={styles.label}>מספר אישי (רשות)</label>
          <input
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            style={styles.input}
          />
        </div>
      </div>

      {/* הערות */}
      <div style={styles.section}>
        <label style={styles.label}>הערות (רשות)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערה פנימית/הקשר"
          style={styles.input}
        />
      </div>

      {/* פריטים */}
      <h3 style={{ marginTop: 12 }}>פריטים לזיכוי</h3>
      {rows.map((row, idx) => (
        <div key={idx} style={styles.itemBox}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr auto", gap: 8, alignItems: "start" }}>
            {/* קומבו־בוקס חיפוש/בחירה */}
            <div>
              <label style={styles.label}>בחר/חפש מוצר</label>
              <SearchableProductSelect
                value={row.productId}
                searchTerm={row.searchTerm}
                onSearch={(txt) =>
                  setRows((prev) => {
                    const next = [...prev];
                    next[idx].searchTerm = txt;
                    if (txt !== next[idx].productLabel) {
                      next[idx].productId = "";
                      next[idx].productLabel = "";
                    }
                    return next;
                  })
                }
                onPick={(p) =>
                  setRows((prev) => {
                    const next = [...prev];
                    const id = String(p._id || p.id);
                    const label = `${p.name || ""}${p.sku ? ` (${p.sku})` : ""}`;
                    next[idx].productId = id;
                    next[idx].productLabel = label;
                    next[idx].searchTerm = label;
                    // ניקוי שדות ידניים אם נבחר מוצר מקטלוג
                    next[idx].manualSku = "";
                    next[idx].manualName = "";
                    return next;
                  })
                }
                fetcher={fetchProducts}
                disabled={false}
              />

              {/* אם לא נבחר מוצר – מאפשרים הזנה ידנית */}
              {!row.productId && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div>
                    <label style={styles.label}>SKU (חובה לפריט ידני)</label>
                    <input
                      placeholder="למשל: ABC-123"
                      value={row.manualSku}
                      onChange={(e) =>
                        setRows((prev) => {
                          const next = [...prev];
                          next[idx].manualSku = e.target.value.toUpperCase();
                          return next;
                        })
                      }
                      style={{ ...styles.input, fontFamily: "monospace", letterSpacing: 1 }}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>שם מוצר (רשות)</label>
                    <input
                      value={row.manualName}
                      onChange={(e) =>
                        setRows((prev) => {
                          const next = [...prev];
                          next[idx].manualName = e.target.value;
                          return next;
                        })
                      }
                      style={styles.input}
                    />
                  </div>
                </div>
              )}

              {/* תצוגה כאשר נבחר מוצר */}
              {row.productId && (
                <div style={styles.chipChosen}>
                  נבחר: {row.productLabel}
                </div>
              )}
            </div>

            {/* כמות */}
            <div>
              <label style={styles.label}>כמות</label>
              <input
                type="number"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(e) =>
                  setRows((prev) => {
                    const next = [...prev];
                    next[idx].quantity = e.target.value;
                    return next;
                  })
                }
                style={styles.input}
              />
            </div>

            {/* הסרה */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => removeRow(idx)} style={{ padding: "8px 12px" }}>
                הסר
              </button>
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
        <button type="button" onClick={addRow} style={{ padding: "8px 12px" }}>
          + הוסף פריט
        </button>
      </div>

      {/* חתימה */}
      <h3 style={{ marginTop: 16, marginBottom: 8, textAlign: "right" }}>חתימה</h3>
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8, marginBottom: 12, textAlign: "right" }}>
        <canvas
          ref={canvasRef}
          width={760}
          height={160}
          style={{ width: "100%", background: "#fff", cursor: "crosshair", touchAction: "none" }}
          onMouseDown={(e) => { startDraw(e); }}
          onMouseMove={(e) => { moveDraw(e); }}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={(e) => { startDraw(e); }}
          onTouchMove={(e) => { moveDraw(e); }}
          onTouchEnd={endDraw}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={clearSignature} style={{ padding: "6px 12px" }}>
            נקה חתימה
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4, textAlign: "right" }}>
          חתום/י בעכבר או באצבע (נייד).
        </div>
      </div>

      {/* כפתור שמירה */}
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
          fontWeight: "bold",
        }}
      >
        {loading ? "שומר..." : "שמור זיכוי"}
      </button>

      {errorMsg && <div style={{ color: "red", marginTop: 8, textAlign: "center" }}>{errorMsg}</div>}
      {successMsg && <div style={{ color: "green", marginTop: 8, textAlign: "center" }}>{successMsg}</div>}
    </form>
  );
}
