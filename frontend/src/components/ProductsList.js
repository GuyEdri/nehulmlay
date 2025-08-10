// frontend/src/components/ProductsList.js
import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import UpdateStock from "./UpdateStock";
import ProductHistory from "./ProductHistory";

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pid = (p) => String(p._id || p.id);

  // טעינת מוצרים (מסוננים לפי חיפוש)
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/products", { params: { search } });
      setProducts(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.error || "שגיאה בטעינת מוצרים");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

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

  return (
    <div style={{ direction: "rtl", textAlign: "right" }}>
      <h3>רשימת מוצרים</h3>

      <input
        placeholder="חפש מוצר..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          marginBottom: "10px",
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          textAlign: "right",
        }}
      />

      {error && (
        <div style={{ color: "red", marginBottom: 10, fontWeight: "bold" }}>{error}</div>
      )}

      {loading && <div style={{ marginBottom: 10 }}>טוען...</div>}

      <table
        border="1"
        cellPadding="8"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          direction: "rtl",
          textAlign: "right",
        }}
      >
        <thead>
          <tr>
            <th>שם</th>
            <th>תיאור</th>
            <th>כמות</th>
            <th>עדכון מלאי</th>
            <th>היסטוריה</th>
            <th>מחיקה</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "#666" }}>
                {loading ? "טוען..." : "לא נמצאו מוצרים"}
              </td>
            </tr>
          ) : (
            products.map((p) => {
              const id = pid(p);
              return (
                <React.Fragment key={id}>
                  <tr>
                    <td>{p.name}</td>
                    <td>{p.description}</td>
                    <td>{p.stock}</td>
                    <td>
                      <UpdateStock productId={id} onUpdate={fetchProducts} />
                    </td>
                    <td>
                      <button onClick={() => handleShowHistory(id)}>
                        {selectedProduct === id ? "הסתר" : "הצג היסטוריה"}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(id)}
                        style={{
                          color: "white",
                          background: "red",
                          border: "none",
                          borderRadius: "5px",
                          padding: "4px 10px",
                          cursor: "pointer",
                        }}
                        disabled={loading}
                      >
                        מחק
                      </button>
                    </td>
                  </tr>
                  {selectedProduct === id && (
                    <tr>
                      <td colSpan={6} style={{ background: "#f7f7f7" }}>
                        <ProductHistory productId={id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

