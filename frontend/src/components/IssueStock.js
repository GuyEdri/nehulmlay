// frontend/src/components/IssueStock.js
import React, { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../api";
import SimpleSignaturePad from "./SignaturePad";

const styles = {
  root: {
    direction: "rtl",
    textAlign: "right",
    maxWidth: 900,
    margin: "0 auto",
    padding: "16px 12px 40px",
    fontFamily: "Arial, sans-serif",
  },
  title: { textAlign: "center", fontSize: 24, fontWeight: 800, margin: "0 0 16px" },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  h2: { textAlign: "center", fontSize: 20, fontWeight: 800, margin: "0 0 16px" },
  form: { display: "grid", gap: 14 },
  row: { display: "grid", gap: 8 },
  label: { fontWeight: 700, fontSize: 14 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    outline: "none",
    fontSize: 15,
    textAlign: "right",
    direction: "rtl",
  },
  select: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    outline: "none",
    fontSize: 15,
    background: "#fff",
    textAlign: "right",
    direction: "rtl",
  },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  button: {
    appearance: "none",
    border: "none",
    background: "#1976d2",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  buttonGhost: {
    appearance: "none",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#111827",
    padding: "12px 16px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  buttonDanger: {
    appearance: "none",
    border: "none",
    background: "#ef4444",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  buttonSuccess: {
    appearance: "none",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 12,
    fontWeight: 900,
    width: "100%",
    fontSize: 16,
    cursor: "pointer",
  },
  alertError: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 12px",
    whiteSpace: "pre-wrap",
  },
  alertSuccess: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "10px 12px",
  },
  sectionBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#fafafa",
  },
  itemBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#ffffff",
  },
  itemHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontWeight: 800,
    marginBottom: 8,
  },
  small: { fontSize: 12, color: "#6b7280" },
  switchRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  threeCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },

  // combobox
  comboWrap: { position: "relative" },
  comboInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    outline: "none",
    fontSize: 15,
    textAlign: "right",
    direction: "rtl",
  },
  comboList: {
    position: "absolute",
    insetInlineStart: 0,
    insetInlineEnd: 0,
    top: "calc(100% + 6px)",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    zIndex: 50,
    maxHeight: 280,
    overflowY: "auto",
  },
  comboItem: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
  },
  comboItemMuted: { color: "#6b7280", fontSize: 12 },
};

function productLabel(p) {
  const sku = p.sku ? `[${p.sku}] ` : "";
  const name = p.name || "";
  const stock = Number.isFinite(Number(p.stock)) ? ` (במלאי: ${p.stock})` : "";
  return `${sku}${name}${stock}`;
}

function filterProducts(products, q) {
  const qx = (q || "").trim();
  if (!qx) return products.slice(0, 30);
  const terms = qx.split(/\s+/).map((t) => t.toLowerCase());
  const score = (p) => {
    const hay = `${p.sku || ""} ${p.name || ""}`.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (hay.includes(t)) s += 1;
    }
    return s;
  };
  return products
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || String(a.p.name || "").localeCompare(String(b.p.name || ""), "he"))
    .slice(0, 30)
    .map((x) => x.p);
}

/** קומבו־בוקס לבחירת מוצר עם חיפוש */
function SearchableProductSelect({ value, searchTerm, onChange, onSearch, products, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const options = useMemo(() => filterProducts(products, searchTerm), [products, searchTerm]);

  // כיתוב בשדה: אם נבחר מוצר ואין חיפוש – מציגים התווית שלו
  const selected = value ? products.find((p) => String(p._id || p.id) === String(value)) : null;
  const inputValue = searchTerm ?? (selected ? productLabel(selected) : "");

  return (
    <div style={styles.comboWrap} ref={wrapRef} dir="rtl">
      <input
        style={styles.comboInput}
        placeholder="הקלד שם/מקט…"
        value={inputValue}
        onChange={(e) => onSearch(e.target.value)}
        onFocus={() => !disabled && setOpen(true)}
        disabled={disabled}
      />
      {open && !disabled && (
        <div style={styles.comboList}>
          {options.length === 0 ? (
            <div style={{ ...styles.comboItem, ...styles.comboItemMuted }}>לא נמצאו תוצאות</div>
          ) : (
            options.map((p) => {
              const id = String(p._id || p.id);
              return (
                <div
                  key={id}
                  style={styles.comboItem}
                  onClick={() => {
                    onChange(id, productLabel(p));
                    setOpen(false);
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ ...styles.comboItemMuted }}>
                    {p.sku ? `מקט: ${p.sku} · ` : ""}מלאי: {p.stock ?? 0}
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

export default function IssueStock({ onIssued }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [allowNoWarehouse, setAllowNoWarehouse] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");

  // item: { type: 'catalog'|'manual', product?, searchTerm?, name?, sku?, quantity }
  const [items, setItems] = useState([{ type: "catalog", product: "", searchTerm: "", quantity: 1 }]);

  const [signature, setSignature] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // טען מחסנים + לקוחות פעם אחת
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [whRes, custsRes] = await Promise.all([
          api.get("/api/warehouses"),
          api.get("/api/customers"),
        ]);
        if (!mounted) return;
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
        setCustomers(Array.isArray(custsRes.data) ? custsRes.data : []);
      } catch {
        if (!mounted) return;
        setWarehouses([]);
        setCustomers([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // טען מוצרים לפי מחסן (כשלא במצב ידני)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (allowNoWarehouse || !warehouseId) {
          setProducts([]);
          return;
        }
        const res = await api.get("/api/products", { params: { warehouseId } });
        if (!mounted) return;
        setProducts(Array.isArray(res.data) ? res.data : []);
        // איפוס שורות קטלוג אם המחסן השתנה
        setItems((prev) =>
          prev.map((row) =>
            row.type === "catalog" ? { ...row, product: "", searchTerm: "", quantity: 1 } : row
          )
        );
      } catch {
        if (!mounted) return;
        setProducts([]);
      }
    })();
    return () => { mounted = false; };
  }, [warehouseId, allowNoWarehouse]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "he")
    );
  }, [products]);

  // עזרי שורות
  const handleItemField = (idx, field, value) => {
    setItems((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const addCatalogItem = () =>
    setItems((rows) => [...rows, { type: "catalog", product: "", searchTerm: "", quantity: 1 }]);
  const addManualItem = () =>
    setItems((rows) => [...rows, { type: "manual", name: "", sku: "", quantity: 1 }]);
  const removeItem = (idx) =>
    setItems((rows) => rows.filter((_, i) => i !== idx));

  // חתימה
  const isValidSignature = (sig) =>
    typeof sig === "string" && sig.startsWith("data:image") && sig.length > 100;

  // מתג ידני
  const handleToggleNoWarehouse = (e) => {
    const next = !!e.target.checked;
    setAllowNoWarehouse(next);
    if (next) {
      setWarehouseId("");
      setProducts([]);
      setItems([{ type: "manual", name: "", sku: "", quantity: 1 }]);
    } else {
      setItems([{ type: "catalog", product: "", searchTerm: "", quantity: 1 }]);
    }
  };

  // שליחה
  const handleIssue = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // ולידציה כללית
    if (!customer || !String(customer).trim()) return setError("יש לבחור לקוח");
    if (!deliveredTo.trim()) return setError("יש להזין שם למי נופק");
    if (!personalNumber.trim()) return setError("יש להזין מספר אישי");
    if (
      items.length === 0 ||
      items.some((i) => !i.quantity || Number.isNaN(Number(i.quantity)) || Number(i.quantity) < 1)
    ) return setError("יש למלא כמות חוקית (>=1) בכל שורה");

    if (!allowNoWarehouse && !warehouseId)
      return setError("יש לבחור מחסן ממנו ינופק המלאי");

    // אימות לפי סוג פריט
    if (allowNoWarehouse) {
      if (items.some((i) => i.type !== "manual"))
        return setError("במצב 'ניפוק ללא מחסן' מותרות רק שורות ידניות.");
      for (const row of items) {
        if (!row.name || !row.name.trim())
          return setError("בפריט ידני יש למלא 'שם פריט'.");
      }
    } else {
      const productMap = new Map(products.map((p) => [String(p._id || p.id), p]));
      for (const row of items) {
        if (row.type === "catalog") {
          if (!row.product) return setError("בחר מוצר עבור כל שורת קטלוג.");
          const p = productMap.get(String(row.product));
          if (!p) return setError("נבחר מוצר לא תקין עבור המחסן הזה");
          if (Number(row.quantity) > Number(p.stock || 0))
            return setError(`הכמות המבוקשת למוצר "${p.name}" גבוהה מהמלאי הקיים`);
        } else if (row.type === "manual") {
          if (!row.name || !row.name.trim())
            return setError("בפריט ידני יש למלא 'שם פריט'.");
        }
      }
    }

    if (!isValidSignature(signature))
      return setError("יש להזין חתימה דיגיטלית תקינה");

    try {
      setLoading(true);

      const catalogItems = [];
      const manualItems = [];

      for (const i of items) {
        const qty = Number(i.quantity);
        if (i.type === "manual") {
          manualItems.push({
            name: String(i.name || "").trim(),
            sku: String(i.sku || "").trim(),
            quantity: qty,
          });
        } else {
          catalogItems.push({
            productId: String(i.product),
            quantity: qty,
          });
        }
      }

      const selectedCustomerObj = customers.find(
        (c) => String(c._id || c.id) === String(customer)
      );
      const customerName = selectedCustomerObj ? selectedCustomerObj.name : "";

      const base = {
        items: catalogItems,
        manualItems,
        customerId: String(customer),
        customer: String(customer),
        deliveredTo: deliveredTo.trim(),
        delivered_to: deliveredTo.trim(),
        personalNumber: personalNumber.trim(),
        personal_number: personalNumber.trim(),
        signature,
        signatureData: signature,
        customerName,
      };

      if (!allowNoWarehouse && warehouseId) {
        base.warehouseId = warehouseId;
      } else {
        base.noWarehouse = true;
      }

      console.log("DELIVERY PAYLOAD", base);
      await api.post("/api/deliveries", base);

      setSuccess("ניפוק בוצע בהצלחה");
      // reset
      setWarehouseId("");
      setCustomer("");
      setDeliveredTo("");
      setPersonalNumber("");
      setItems([
        {
          type: allowNoWarehouse ? "manual" : "catalog",
          ...(allowNoWarehouse ? { name: "", sku: "" } : { product: "", searchTerm: "" }),
          quantity: 1,
        },
      ]);
      setSignature(null);
      if (onIssued) onIssued();
    } catch (err) {
      const srv = err?.response?.data;
      const details =
        typeof srv === "object" ? JSON.stringify(srv, null, 2) :
        typeof srv === "string" ? srv :
        (err?.message || "");
      setError(`שגיאה בניפוק.\n${details}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.root}>
      <h1 style={styles.title}>חטיבה 551</h1>
      <div style={styles.card}>
        <h2 style={styles.h2}>ניפוק מלאי ללקוח</h2>

        <form onSubmit={handleIssue} style={styles.form} dir="rtl">
          {/* מצב ידני */}
          <div style={{ ...styles.row, ...styles.sectionBox }}>
            <div style={styles.switchRow}>
              <input
                id="manual-switch"
                type="checkbox"
                checked={allowNoWarehouse}
                onChange={handleToggleNoWarehouse}
              />
              <label htmlFor="manual-switch" style={{ fontWeight: 700 }}>
                ניפוק ללא מחסן (ידני)
              </label>
            </div>
            <div style={styles.small}>
              כאשר האפשרות מסומנת, אין צורך לבחור מחסן. ניתן להוסיף פריטים ידניים (שם, מק״ט, כמות).
            </div>
          </div>

          {/* מחסן (כשלא ידני) */}
          {!allowNoWarehouse && (
            <div style={styles.row}>
              <label htmlFor="wh" style={styles.label}>בחר מחסן *</label>
              <select
                id="wh"
                style={styles.select}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                <option value="">בחר</option>
                {warehouses.map((w) => (
                  <option key={w._id || w.id} value={String(w._id || w.id)}>
                    {w.name || "(ללא שם)"}{w.address ? ` — ${w.address}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* לקוח */}
          <div style={styles.row}>
            <label htmlFor="cust" style={styles.label}>בחר לקוח *</label>
            <select
              id="cust"
              style={styles.select}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              required
            >
              <option value="">בחר</option>
              {customers.map((c) => (
                <option key={c._id || c.id} value={String(c._id || c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* למי נופק + מספר אישי */}
          <div style={styles.twoCols}>
            <div style={styles.row}>
              <label htmlFor="deliveredTo" style={styles.label}>שם למי נופק *</label>
              <input
                id="deliveredTo"
                style={styles.input}
                value={deliveredTo}
                onChange={(e) => setDeliveredTo(e.target.value)}
                required
              />
            </div>
            <div style={styles.row}>
              <label htmlFor="pn" style={styles.label}>מספר אישי *</label>
              <input
                id="pn"
                style={styles.input}
                value={personalNumber}
                onChange={(e) => setPersonalNumber(e.target.value)}
                required
              />
            </div>
          </div>

          {/* שורות פריטים */}
          <div style={{ ...styles.row, gap: 10 }}>
            {items.map((item, idx) => (
              <div key={idx} style={styles.itemBox}>
                <div style={styles.itemHeader}>
                  <div>פריט #{idx + 1} — {item.type === "manual" ? "ידני" : "קטלוג"}</div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={styles.buttonDanger}
                    >
                      מחק פריט
                    </button>
                  )}
                </div>

                {item.type === "catalog" ? (
                  <div style={styles.twoCols}>
                    <div style={styles.row}>
                      <label style={styles.label}>בחר/חפש מוצר *</label>
                      <SearchableProductSelect
                        value={item.product ? String(item.product) : ""}
                        searchTerm={item.searchTerm ?? ""}
                        onSearch={(q) => handleItemField(idx, "searchTerm", q)}
                        onChange={(id, label) => {
                          handleItemField(idx, "product", id);
                          handleItemField(idx, "searchTerm", label);
                        }}
                        products={sortedProducts}
                        disabled={allowNoWarehouse || !warehouseId}
                      />
                    </div>

                    <div style={styles.row}>
                      <label style={styles.label}>כמות *</label>
                      <input
                        type="number"
                        min={1}
                        style={styles.input}
                        value={item.quantity}
                        onChange={(e) => handleItemField(idx, "quantity", e.target.value)}
                        disabled={allowNoWarehouse || !warehouseId}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div style={styles.threeCols}>
                    <div style={styles.row}>
                      <label style={styles.label}>שם פריט (ידני) *</label>
                      <input
                        style={styles.input}
                        value={item.name || ""}
                        onChange={(e) => handleItemField(idx, "name", e.target.value)}
                        required
                      />
                    </div>
                    <div style={styles.row}>
                      <label style={styles.label}>מקט (אופציונלי)</label>
                      <input
                        style={styles.input}
                        value={item.sku || ""}
                        onChange={(e) => handleItemField(idx, "sku", e.target.value)}
                      />
                    </div>
                    <div style={styles.row}>
                      <label style={styles.label}>כמות *</label>
                      <input
                        type="number"
                        min={1}
                        style={styles.input}
                        value={item.quantity}
                        onChange={(e) => handleItemField(idx, "quantity", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={styles.btnRow}>
              <button type="button" style={styles.buttonGhost} onClick={addManualItem}>
                הוסף פריט ידני
              </button>
              <button
                type="button"
                style={styles.buttonGhost}
                onClick={addCatalogItem}
                disabled={allowNoWarehouse}
                title={allowNoWarehouse ? "במצב ידני לא ניתן להוסיף פריטי קטלוג" : ""}
              >
                הוסף פריט מקטלוג
              </button>
            </div>
          </div>

          {/* חתימה */}
          <div style={styles.row}>
            <label style={styles.label}>חתימה דיגיטלית (חובה)</label>
            <SimpleSignaturePad onEnd={setSignature} />
            <div style={styles.small}>יש לחתום בתוך המסגרת.</div>
          </div>

          {/* שליחה */}
          <button type="submit" style={styles.buttonSuccess} disabled={loading}>
            {loading ? "מנפק…" : "נפק"}
          </button>

          {/* הודעות */}
          {error && <div style={styles.alertError}>{error}</div>}
          {success && <div style={styles.alertSuccess}>{success}</div>}
        </form>
      </div>
    </div>
  );
}
