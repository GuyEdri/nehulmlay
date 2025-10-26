// frontend/src/components/ReturnsList.js
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../api";
import "./deliveries-list.css"; // משתמש באותו CSS של DeliveriesList

// ---- עזרי תאריך (כמו ב-DeliveriesList) ----
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

/* ---------------------------
 * טבלת פריטים קטנה (RTL)
 * מציגה גם פריטי קטלוג וגם פריטים ידניים
 * --------------------------- */
function ItemsMiniTable({ catalogItems, manualItems, getName, getSku }) {
  const rows = [];

  if (Array.isArray(catalogItems)) {
    for (const it of catalogItems) {
      rows.push({
        sku: getSku(it.product) || "—",
        name: getName(it.product),
        quantity: Number(it.quantity || 0),
      });
    }
  }
  if (Array.isArray(manualItems)) {
    for (const mi of manualItems) {
      rows.push({
        sku: mi.sku || "",
        name: mi.name || "פריט ידני",
        quantity: Number(mi.quantity || 0),
      });
    }
  }

  if (rows.length === 0) return <div className="dl-empty">—</div>;

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
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.sku || "—"}</td>
            <td>{r.name}</td>
            <td>{r.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ReturnsList() {
  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [retRes, prodsRes] = await Promise.all([
          api.get("/api/returns"),
          api.get("/api/products"),
        ]);
        setReturns(Array.isArray(retRes.data) ? retRes.data : []);
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
      } catch (e) {
        setErr(e?.response?.data?.error || "שגיאה בטעינת נתונים");
        setReturns([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // מפה מהירה של מוצרים (id -> {name, sku})
  const productMap = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => {
      const id = String(p._id || p.id);
      m.set(id, { name: p.name || "", sku: p.sku || "" });
    });
    return m;
  }, [products]);

  const getProductName = (id) => productMap.get(String(id))?.name || String(id);
  const getProductSku  = (id) => productMap.get(String(id))?.sku  || "";

  // לקוחות לבחירה
  const customerOptions = useMemo(
    () => _.uniq((returns || []).map((r) => r.customerName).filter(Boolean)).sort(),
    [returns]
  );

  // סינון לפי לקוח
  const filteredReturns = useMemo(
    () => (selectedCustomer ? returns.filter((r) => r.customerName === selectedCustomer) : returns),
    [returns, selectedCustomer]
  );

  // קיבוץ לפי לקוח + מיון תאריכים
  const grouped = useMemo(() => {
    return _(filteredReturns)
      .groupBy((r) => r.customerName || "ללא שם לקוח")
      .map((items, customerName) => ({
        customerName,
        returns: _.orderBy(items, (r) => toDate(r?.date)?.getTime() ?? 0, ["desc"]),
      }))
      .value();
  }, [filteredReturns]);

  // הורדת PDF
  const handleDownloadReceipt = async (returnId) => {
    try {
      const res = await api.post(`/api/returns/${returnId}/receipt`, {}, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `return_${returnId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("שגיאה בהורדת אישור הזיכוי");
    }
  };

  // ייצוא אקסל (כולל פריטים ידניים)
  const exportToExcel = () => {
    const rows = [];
    grouped.forEach((group) => {
      group.returns.forEach((r) => {
        const allSKUs = [
          ...(r.items || []).map((it) => getProductSku(it.product) || "—"),
          ...(r.manualItems || []).map((mi) => mi.sku || ""),
        ].filter((x) => x !== undefined);

        const allNames = [
          ...(r.items || []).map((it) => getProductName(it.product)),
          ...(r.manualItems || []).map((mi) => mi.name || "פריט ידני"),
        ];

        const allQtys = [
          ...(r.items || []).map((it) => Number(it.quantity || 0)),
          ...(r.manualItems || []).map((mi) => Number(mi.quantity || 0)),
        ];

        rows.push({
          "לקוח": group.customerName,
          "תאריך": formatDate(r.date),
          "הוחזר ע״י": r.returnedBy || "",
          "מחסן יעד": r.warehouseName || r.warehouseId || "",
          "מקטים": allSKUs.join(", "),
          "מוצרים": allNames.join(", "),
          "כמויות": allQtys.join(", "),
          "חתימה": r.signature ? "כן" : "לא",
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "זיכויים");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "returns.xlsx");
  };

  if (loading) {
    return <div className="dl-status">טוען…</div>;
  }
  if (err) {
    return <div className="dl-status dl-error">{err}</div>;
  }
  if (!returns || returns.length === 0) {
    return <div className="dl-status dl-muted">אין זיכויים להצגה</div>;
  }

  return (
    <div className="dl-root" dir="rtl">
      {/* כותרת + ייצוא */}
      <div className="dl-header">
        <h2>רשימת זיכויים לפי לקוח</h2>
        <button className="dl-btn primary" onClick={exportToExcel}>ייצוא לאקסל</button>
      </div>

      {/* סינון לקוח */}
      <div className="dl-filter">
        <label>סנן לפי לקוח:</label>
        <select
          className="dl-select"
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
        >
          <option value="">הצג הכל</option>
          {customerOptions.map((cn) => (
            <option key={cn} value={cn}>{cn}</option>
          ))}
        </select>
      </div>

      {/* קבוצות לפי לקוח */}
      {grouped.map((group) => (
        <div key={group.customerName} className="dl-group">
          <div className="dl-group-header">
            <h3>{group.customerName}</h3>
          </div>

          {group.returns.map((ret, idx) => (
            <div key={ret._id || ret.id || idx} className="dl-card">
              <div className="dl-card-row"><span>תאריך:</span> {formatDate(ret.date)}</div>
              <div className="dl-card-row"><span>הוחזר ע״י:</span> {ret.returnedBy || "—"}</div>
              <div className="dl-card-row"><span>מחסן יעד:</span> {ret.warehouseName || ret.warehouseId || "—"}</div>

              <div className="dl-card-row">
                <span>פריטים:</span>
                <ItemsMiniTable
                  catalogItems={ret.items}
                  manualItems={ret.manualItems}
                  getName={getProductName}
                  getSku={getProductSku}
                />
              </div>

              <div className="dl-card-actions">
                {ret.signature ? (
                  <button
                    className="dl-icon-btn"
                    onClick={() => handleDownloadReceipt(ret._id || ret.id)}
                    title="הורד אישור זיכוי PDF"
                  >
                    <PictureAsPdfIcon style={{ color: "red" }} />
                  </button>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
