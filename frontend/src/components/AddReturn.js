// frontend/src/components/AddReturn.js
import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function AddReturn({ onCreated }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [returnedBy, setReturnedBy] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [personalNumber, setPersonalNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([
    { productId: "", productLabel: "", searchTerm: "", suggestions: [], quantity: 1, manualSku: "", manualName: "" },
  ]);

  const [signature, setSignature] = useState("");
  const canvasRef = useRef(null);
  const drawing = useRef(false);

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
        const custs = Array.isArray(custRes.data) ? custRes.data : [];
        setCustomers(custs);
      } catch {
        if (!mounted) return;
        setWarehouses([]);
        setCustomers([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!customerId) return setCustomerName("");
    const c = customers.find((x) => String(x.id || x._id) === String(customerId));
    setCustomerName(c?.name || "");
  }, [customerId, customers]);

  const timers = useRef({});

  const searchProducts = async (idx, term) => {
    try {
      const res = await api.get(`/api/products?search=${encodeURIComponent(term)}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setRows((prev) => {
        const next = [...prev];
        next[idx].suggestions = list;
        return next;
      });
    } catch {
      setRows((prev) => {
        const next = [...prev];
        next[idx].suggestions = [];
        return next;
      });
    }
  };

  const onPickSuggestion = (idx, product) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx].productId = String(product._id || product.id);
      next[idx].productLabel = `${product.name || ""} (${product.sku || ""})`;
      next[idx].searchTerm = next[idx].productLabel;
      next[idx].suggestions = [];
      next[idx].manualSku = "";
      next[idx].manualName = "";
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, { productId: "", productLabel: "", searchTerm: "", suggestions: [], quantity: 1, manualSku: "", manualName: "" }]);
  };

  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // ציור חתימה
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
    if (canvasRef.current) {
      setSignature(canvasRef.current.toDataURL("image/png"));
    }
  };
  const clearSignature = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    setSignature("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!customerId || !customerName) return setErrorMsg("יש לבחור לקוח");
    if (!returnedBy.trim()) return setErrorMsg("יש למלא 'הוחזר ע\"י'");
    if (!rows.length) return setErrorMsg("יש להוסיף לפחות פריט אחד");

    const itemsToSend = [];
    for (const r of rows) {
      const qty = Number(r.quantity);
      if (!Number.isFinite(qty) || qty < 1) return setErrorMsg("כמות חייבת להיות חיובית");
      if (r.productId) itemsToSend.push({ product: String(r.productId), quantity: qty });
      else if ((r.manualSku || "").trim())
        itemsToSend.push({ sku: r.manualSku.trim().toUpperCase(), name: r.manualName.trim(), quantity: qty });
      else return setErrorMsg("כל פריט חייב מוצר או SKU ידני");
    }

    const hasManual = itemsToSend.some((it) => it.sku && !it.product);
    if (hasManual && !warehouseId) return setErrorMsg("יש לבחור מחסן יעד עבור פריטים ידניים");

    try {
      setLoading(true);
      const body = {
        warehouseId,
        customer: customerId,
        customerName,
        returnedBy,
        items: itemsToSend,
        date: new Date(date).toISOString(),
        personalNumber,
        notes,
        ...(signature ? { signature } : {}),
      };
      const res = await api.post("/api/returns", body);
      setSuccessMsg("הזיכוי נשמר בהצלחה ✅");
      // reset
      setWarehouseId("");
      setCustomerId("");
      setCustomerName("");
      setReturnedBy("");
      setPersonalNumber("");
      setNotes("");
      setDate(new Date().toISOString().slice(0, 16));
      setRows([{ productId: "", productLabel: "", searchTerm: "", suggestions: [], quantity: 1, manualSku: "", manualName: "" }]);
      clearSignature();
      if (onCreated) onCreated(res.data);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || "שגיאה בשמירת הזיכוי");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 820,
        margin: "auto",
        direction: "rtl",
        textAlign: "right",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h2 style={{ textAlign: "center" }}>זיכוי מלאי</h2>

      {/* מחסן יעד */}
      <label>מחסן יעד</label>
      <select
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 10, textAlign: "right" }}
      >
        <option value="">בחר… (רשות; חובה לפריטים ידניים)</option>
        {warehouses.map((w) => (
          <option key={w.id || w._id} value={String(w.id || w._id)}>
            {w.name || "(ללא שם)"}{w.address ? ` — ${w.address}` : ""}
          </option>
        ))}
      </select>

      {/* לקוח + מי החזיר + תאריך */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          direction: "rtl",
          textAlign: "right",
        }}
      >
        <div>
          <label>לקוח</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10, textAlign: "right" }}
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
          <label>הוחזר ע״י</label>
          <input
            value={returnedBy}
            onChange={(e) => setReturnedBy(e.target.value)}
            placeholder="שם המוסר"
            style={{ width: "100%", padding: 8, marginBottom: 10, textAlign: "right" }}
            required
          />
        </div>

        <div>
          <label>תאריך ושעה</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10, textAlign: "right" }}
          />
        </div>

        <div>
          <label>מספר אישי (רשות)</label>
          <input
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10, textAlign: "right" }}
          />
        </div>
      </div>

      {/* הערות */}
      <label>הערות (רשות)</label>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="הערה פנימית/הקשר"
        style={{ width: "100%", padding: 8, marginBottom: 10, textAlign: "right" }}
      />

      {/* פריטים */}
      <h3 style={{ marginTop: 12 }}>פריטים לזיכוי</h3>
      {rows.map((row, idx) => (
        <div key={idx} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr auto", gap: 8, alignItems: "start" }}>
            {/* חיפוש מוצר */}
            <div>
              <input
                placeholder="חפש מוצר לפי שם/מקט… (או מלא ידנית למטה)"
                value={row.searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setRows((prev) => {
                    const next = [...prev];
                    next[idx].searchTerm = val;
                    if (val !== next[idx].productLabel) {
                      next[idx].productId = "";
                      next[idx].productLabel = "";
                    }
                    return next;
                  });

                  if (val.trim().length >= 2) {
                    if (timers.current[idx]) clearTimeout(timers.current[idx]);
                    timers.current[idx] = setTimeout(() => searchProducts(idx, val.trim()), 250);
                  } else {
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx].suggestions = [];
                      return next;
                    });
                  }
                }}
                style={{ width: "100%", padding: 8, marginBottom: 6, textAlign: "right" }}
              />

              {row.suggestions.length > 0 && (
                <div style={{ border: "1px solid #ccc", borderRadius: 4, maxHeight: 160, overflowY: "auto" }}>
                  {row.suggestions.map((p) => (
                    <div
                      key={p._id || p.id}
                      onClick={() => onPickSuggestion(idx, p)}
                      style={{ padding: "6px 8px", cursor: "pointer", textAlign: "right" }}
                    >
                      <div style={{ fontWeight: 600 }}>{p.name || "(ללא שם)"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.8 }}>
                        {p.sku} {p.warehouseName ? `• מחסן: ${p.warehouseName}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!row.productId && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <input
                    placeholder="SKU (חובה לפריט ידני)"
                    value={row.manualSku}
                    onChange={(e) =>
                      setRows((prev) => {
                        const next = [...prev];
                        next[idx].manualSku = e.target.value.toUpperCase();
                        return next;
                      })
                    }
                    style={{ width: "100%", padding: 8, textAlign: "right", fontFamily: "monospace", letterSpacing: 1 }}
                  />
                  <input
                    placeholder="שם מוצר (רשות)"
                    value={row.manualName}
                    onChange={(e) =>
                      setRows((prev) => {
                        const next = [...prev];
                        next[idx].manualName = e.target.value;
                        return next;
                      })
                    }
                    style={{ width: "100%", padding: 8, textAlign: "right" }}
                  />
                </div>
              )}

              {row.productId && (
                <div style={{ fontSize: 12, color: "#444", marginTop: 4, textAlign: "right" }}>
                  נבחר: {row.productLabel}
                </div>
              )}
            </div>

            {/* כמות */}
            <div>
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
                style={{ width: "100%", padding: 8, textAlign: "right" }}
              />
            </div>

            {/* הסרה */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => removeRow(idx)} style={{ padding: "6px 10px" }}>
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
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
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

