import React, { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { api } from "../api";
import "./deliveries-list.css"; // נוסיף CSS משלנו

// --- עזר להמרת תאריכים ---
const toDate = (date) => {
  try {
    if (!date) return null;
    if (typeof date === "object") {
      const sec = date.seconds ?? date._seconds;
      const nsec = date.nanoseconds ?? date._nanoseconds ?? 0;
      if (typeof sec === "number") return new Date(sec * 1000 + Math.floor(nsec / 1e6));
    }
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const formatDate = (date) => {
  const d = toDate(date);
  if (!d) return "—";
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// טבלת פריטים קטנה
function ItemsMiniTable({ items, getName, getSku }) {
  if (!Array.isArray(items) || items.length === 0)
    return <div className="dl-empty">—</div>;

  return (
    <table className="dl-items-table" dir="rtl">
      <thead>
        <tr>
          <th>מקט</th>
          <th>שם מוצר</th>
          <th>כמות</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i}>
            <td>{getSku(it.product) || "—"}</td>
            <td>{getName(it.product)}</td>
            <td>{it.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DeliveriesList() {
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [delsRes, prodsRes] = await Promise.all([
          api.get("/api/deliveries"),
          api.get("/api/products"),
        ]);
        setDeliveries(Array.isArray(delsRes.data) ? delsRes.data : []);
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
      } catch {
        setDeliveries([]);
        setProducts([]);
      }
    })();
  }, []);

  const productMap = useMemo(() => {
    const m = new Map();
    products.forEach((p) => m.set(String(p._id || p.id), { name: p.name, sku: p.sku || "" }));
    return m;
  }, [products]);

  const getProductName = (id) => productMap.get(String(id))?.name || String(id);
  const getProductSku = (id) => productMap.get(String(id))?.sku || "";

  const customerOptions = useMemo(
    () => _.uniq(deliveries.map((d) => d.customerName).filter(Boolean)).sort(),
    [deliveries]
  );

  const filteredDeliveries = useMemo(
    () => (selectedCustomer ? deliveries.filter((d) => d.customerName === selectedCustomer) : deliveries),
    [deliveries, selectedCustomer]
  );

  const groupedAndSorted = useMemo(() => {
    return _(filteredDeliveries)
      .groupBy((d) => d.customerName || "ללא שם לקוח")
      .map((items, customerName) => ({
        customerName,
        deliveries: _.orderBy(items, (d) => toDate(d?.date)?.getTime() ?? 0, ["desc"]),
      }))
      .orderBy("customerName", ["asc"])
      .value();
  }, [filteredDeliveries]);

  const handleDownloadReceipt = async (deliveryId) => {
    try {
      const res = await api.post(`/api/deliveries/${deliveryId}/receipt`, {}, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt_${deliveryId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("שגיאה בהורדת הקבלה");
    }
  };

  const exportToExcel = () => {
    const rows = [];
    groupedAndSorted.forEach((group) => {
      group.deliveries.forEach((d) => {
        const itemSKUs = d.items?.map(it => getProductSku(it.product) || "—").join(", ") || "";
        const itemNames = d.items?.map(it => getProductName(it.product)).join(", ") || "";
        const itemQtys = d.items?.map(it => it.quantity).join(", ") || "";
        rows.push({
          "לקוח": group.customerName,
          "תאריך": formatDate(d.date),
          "למי נופק": d.deliveredTo || "",
          "מקטים": itemSKUs,
          "מוצרים": itemNames,
          "כמויות": itemQtys,
          "חתימה": d.signature ? "כן" : "לא",
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ניפוקים");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "deliveries.xlsx");
  };

  return (
    <div className="dl-root" dir="rtl">
      <div className="dl-header">
        <h2>רשימת ניפוקים לפי לקוח</h2>
        <button className="dl-btn primary" onClick={exportToExcel}>ייצוא לאקסל</button>
      </div>

      <div className="dl-filter">
        <label>סנן לפי לקוח:</label>
        <select
          className="dl-select"
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
        >
          <option value="">הצג הכל</option>
          {customerOptions.map((cn) => (
            <option value={cn} key={cn}>{cn}</option>
          ))}
        </select>
      </div>

      {groupedAndSorted.length === 0 && (
        <div className="dl-empty">לא נמצאו ניפוקים</div>
      )}

      {groupedAndSorted.map((group) => (
        <div key={group.customerName} className="dl-group">
          <h3>{group.customerName}</h3>
          <table className="dl-table" dir="rtl">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>למי נופק</th>
                <th>פריטים (מקט | שם מוצר | כמות)</th>
                <th>חתימה</th>
              </tr>
            </thead>
            <tbody>
              {group.deliveries.map((delivery, idx) => (
                <tr key={delivery._id || delivery.id || idx}>
                  <td>{formatDate(delivery.date)}</td>
                  <td>{delivery.deliveredTo || "—"}</td>
                  <td>
                    <ItemsMiniTable
                      items={delivery.items}
                      getName={getProductName}
                      getSku={getProductSku}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {delivery.signature ? (
                      <button
                        className="dl-pdf-btn"
                        onClick={() => handleDownloadReceipt(delivery._id || delivery.id)}
                      >
                        <PictureAsPdfIcon style={{ color: "red", verticalAlign: "middle" }} />
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
