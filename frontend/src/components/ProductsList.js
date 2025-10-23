// frontend/src/components/ProductsList.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api";
import ProductHistory from "./ProductHistory";
import "./products-list.css"; // ← חשוב!

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // שינוי מלאי לכל מוצר
  const [deltas, setDeltas] = useState({}); // { [productId]: string }
  const [rowBusy, setRowBusy] = useState({}); // אינדיקציית טעינה לשורה

  const pid = (p) => String(p._id || p.id);

  // טען מחסנים
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/warehouses");
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!mounted) return;
        setWarehouses([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // מפה ID→שם
  const whMap = useMemo(() => {
    const m = new Map();
    (warehouses || []).forEach(w => {
      const id = String(w._id || w.id);
      m.set(id, w.name || "(ללא שם)");
    });
    return m;
  }, [warehouses]);

 // const getWhName = (wid) => {
   // if (!wid) return "ללא שיוך";
    //const key = String(wid);
    //return whMap.get(key) || key;
  //};

  // טעינת מוצרים (סינון מחסן + חיפוש)
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedWarehouse) params.warehouse = selectedWarehouse;
      if (search) params.search = search;
      const res = await api.get("/api/products", { params });
      setProducts(res.data || []);
    } catch (err) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleShowHistory = (productId) => {
    setSelectedProduct(selectedProduct === productId ? null : productId);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק מוצר זה?")) return;
    try {
      setLoading(true);
      await api.delete(`/api/products/${productId}`);
      if (selectedProduct === productId) setSelectedProduct(null);
      fetchProducts();
    } catch (err) {
      alert("שגיאה במחיקת מוצר: " + (err?.response?.data?.error || err?.message));
    } finally {
      setLoading(false);
    }
  };

  const setDelta = (productId, value) => {
    setDeltas((prev) => ({ ...prev, [productId]: value }));
  };

  const handleAdjustStock = async (productId) => {
    const raw = deltas[productId];
    const deltaNum = Number(raw);

    if (!raw || !Number.isFinite(deltaNum) || !Number.isInteger(deltaNum) || deltaNum === 0) {
      alert("הכנס שינוי מלאי שונה מאפס (מספר שלם, אפשר שלילי להפחתה).");
      return;
    }

    try {
      setRowBusy((prev) => ({ ...prev, [productId]: true }));
      await api.put(`/api/products/${productId}/stock`, { diff: deltaNum });
      setDelta(productId, "");
      await fetchProducts();
    } catch (err) {
      alert("שגיאה בעדכון מלאי: " + (err?.response?.data?.error || err?.message));
    } finally {
      setRowBusy((prev) => ({ ...prev, [productId]: false }));
    }
  };

  // שינוי שיוך מחסן למוצר
  const handleChangeWarehouse = async (productId, newWarehouseId) => {
    try {
      setRowBusy((prev) => ({ ...prev, [productId]: true }));
      const patch = { warehouseId: newWarehouseId ? String(newWarehouseId) : "" }; // ""=ללא שיוך
      await api.put(`/api/products/${productId}`, patch);
      await fetchProducts();
    } catch (err) {
      alert("שגיאה בעדכון המחסן: " + (err?.response?.data?.error || err?.message));
    } finally {
      setRowBusy((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const noResults = !loading && products.length === 0;

  return (
    <div className="pl-root" dir="rtl">
      {/* פס עליון: כותרת, חיפוש, מסנן מחסן */}
      <div className="pl-topbar">
        <h2 className="pl-title">רשימת מוצרים</h2>

        <div className="pl-filters">
          <select
            className="pl-select"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">כל המחסנים</option>
            {warehouses.map(w => (
              <option key={w._id || w.id} value={String(w._id || w.id)}>
                {w.name || "(ללא שם)"}
              </option>
            ))}
          </select>

          <input
            className="pl-input"
            placeholder="חפש מוצר בשם או במקט…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* הודעות מצב */}
      {loading && <div className="pl-status">טוען…</div>}
      {noResults && <div className="pl-status pl-muted">לא נמצאו מוצרים</div>}

      {/* רשימת מובייל (כרטיסים) */}
      <div className="pl-cards">
        {products.map((p) => {
          const id = pid(p);
          const open = selectedProduct === id;
          const busy = !!rowBusy[id];

          return (
            <div key={id} className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-name">{p.name}</div>
                <button className="pl-btn danger outline" onClick={() => handleDelete(id)} disabled={busy}>
                  מחק
                </button>
              </div>

              <div className="pl-kv">
                <div className="pl-key">מקט</div>
                <div className="pl-val monospace">{p.sku || "—"}</div>
              </div>

              {p.description && (
                <div className="pl-kv">
                  <div className="pl-key">תיאור</div>
                  <div className="pl-val muted">{p.description}</div>
                </div>
              )}

              <div className="pl-kv">
                <div className="pl-key">כמות</div>
                <div className="pl-val"><b>{busy ? "…" : p.stock}</b></div>
              </div>

              <div className="pl-kv">
                <div className="pl-key">מחסן</div>
                <div className="pl-val">
                  <div className="pl-wh">
                    <div className="pl-wh-name">{getWhName(p.warehouseId)}</div>
                    <select
                      className="pl-select"
                      value={p.warehouseId || ""}
                      onChange={(e) => handleChangeWarehouse(id, e.target.value)}
                      disabled={busy}
                    >
                      <option value="">ללא שיוך</option>
                      {warehouses.map(w => (
                        <option key={w._id || w.id} value={String(w._id || w.id)}>
                          {w.name || "(ללא שם)"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pl-row">
                <input
                  className="pl-input"
                  type="number"
                  placeholder="Δ שינוי מלאי (למשל 5 או -3)"
                  value={deltas[id] ?? ""}
                  onChange={(e) => setDelta(id, e.target.value)}
                  style={{ textAlign: "right" }}
                />
                <button className="pl-btn primary" onClick={() => handleAdjustStock(id)} disabled={busy}>
                  עדכן
                </button>
              </div>

              <div className="pl-row">
                <button className="pl-btn" onClick={() => handleShowHistory(id)}>
                  {open ? "הסתר היסטוריה" : "הצג היסטוריה"}
                </button>
              </div>

              {open && (
                <div className="pl-history">
                  <ProductHistory productId={id} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* טבלת דסקטופ */}
      <div className="pl-table-wrap">
        <table className="pl-table" dir="rtl">
          <thead>
            <tr>
              <th>מקט</th>
              <th>שם</th>
              <th>תיאור</th>
              <th>כמות</th>
              <th>מחסן</th>
              <th>שינוי מלאי (Δ)</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const id = pid(p);
              const busy = !!rowBusy[id];
              const open = selectedProduct === id;

              return (
                <React.Fragment key={id}>
                  <tr>
                    <td className="monospace">{p.sku || "—"}</td>
                    <td>{p.name}</td>
                    <td className="muted">{p.description || ""}</td>
                    <td><b>{busy ? "…" : p.stock}</b></td>
                    <td>
                      <div className="pl-wh">
                        <div className="pl-wh-name">{getWhName(p.warehouseId)}</div>
                        <select
                          className="pl-select"
                          value={p.warehouseId || ""}
                          onChange={(e) => handleChangeWarehouse(id, e.target.value)}
                          disabled={busy}
                        >
                          <option value="">ללא שיוך</option>
                          {warehouses.map(w => (
                            <option key={w._id || w.id} value={String(w._id || w.id)}>
                              {w.name || "(ללא שם)"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="pl-row nowrap">
                        <input
                          className="pl-input"
                          type="number"
                          placeholder="Δ"
                          value={deltas[id] ?? ""}
                          onChange={(e) => setDelta(id, e.target.value)}
                          style={{ width: 120, textAlign: "right" }}
                        />
                        <button className="pl-btn primary" onClick={() => handleAdjustStock(id)} disabled={busy}>
                          עדכן
                        </button>
                      </div>
                    </td>
                    <td className="nowrap">
                      <button className="pl-btn" onClick={() => handleShowHistory(id)}>
                        {open ? "הסתר היסטוריה" : "הצג היסטוריה"}
                      </button>
                      <button className="pl-btn danger outline" onClick={() => handleDelete(id)} disabled={busy}>
                        מחק
                      </button>
                    </td>
                  </tr>

                  {open && (
                    <tr className="pl-history-row">
                      <td colSpan={7}>
                        <ProductHistory productId={id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
