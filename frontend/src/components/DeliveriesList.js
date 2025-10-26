// frontend/src/components/DeliveriesList.js
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import UndoIcon from "@mui/icons-material/Undo";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../api";
import AddReturn from "./AddReturn";
import "./deliveries-list.css";

// עזרי תאריך
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

export default function DeliveriesList() {
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");

  // מודאל זיכוי
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [prefillForReturn, setPrefillForReturn] = useState(null);

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

  // מפה מהירה של מוצרים
  const productMap = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => {
      const id = String(p._id || p.id);
      m.set(id, {
        name: p.name || "",
        sku: p.sku || "",
        warehouseId: p.warehouseId || "",
      });
    });
    return m;
  }, [products]);

  const getProductName = (id) => productMap.get(String(id))?.name || String(id);
  const getProductSku  = (id) => productMap.get(String(id))?.sku  || "";
  const getProductWh   = (id) => productMap.get(String(id))?.warehouseId || "";

  // לקוחות לבחירה
  const customerOptions = useMemo(
    () => _.uniq((deliveries || []).map((d) => d.customerName).filter(Boolean)).sort(),
    [deliveries]
  );

  // סינון לפי לקוח
  const filteredDeliveries = useMemo(
    () => (selectedCustomer ? deliveries.filter((d) => d.customerName === selectedCustomer) : deliveries),
    [deliveries, selectedCustomer]
  );

  // קיבוץ לפי לקוח + מיון תאריכים
  const grouped = useMemo(() => {
    return _(filteredDeliveries)
      .groupBy((d) => d.customerName || "ללא שם לקוח")
      .map((items, customerName) => ({
        customerName,
        deliveries: _.orderBy(items, (d) => toDate(d?.date)?.getTime() ?? 0, ["desc"]),
      }))
      .value();
  }, [filteredDeliveries]);

  // הורדת PDF
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

  // לחיצה על "זיכוי" — בונים prefill ל־AddReturn
  const handleCredit = (delivery) => {
    // נחזיר למחסן המקורי (אם יש)
    const warehouseId = String(delivery.warehouseId || "");
    const returnedBy = String(delivery.deliveredTo || "");
    const customerId = String(delivery.customer || "");
    const customerName = String(delivery.customerName || "");

    // פריטי זיכוי רק עבור פריטי קטלוג (פריטים ידניים לא משנים מלאי)
    const rows = (delivery.items || []).map((it) => {
      const pid = String(it.product || "");
      const name = getProductName(pid);
      const sku = getProductSku(pid);
      return {
        productId: pid,
        productLabel: `${name}${sku ? ` (${sku})` : ""}`,
        searchTerm: `${name}${sku ? ` (${sku})` : ""}`,
        suggestions: [],
        quantity: Number(it.quantity || 1),
        manualSku: "",
        manualName: "",
      };
    });

    setPrefillForReturn({
      warehouseId,
      customerId,
      customerName,
      returnedBy,
      date: new Date().toISOString().slice(0, 16),
      personalNumber: "",
      notes: `זיכוי אוטומטי מניפוק ${delivery._id || delivery.id || ""}`,
      rows,
    });
    setShowReturnModal(true);
  };

  // ייצוא אקסל (כולל פריטים ידניים)
  const exportToExcel = () => {
    const rows = [];
    grouped.forEach((group) => {
      group.deliveries.forEach((d) => {
        const allSKUs = [
          ...(d.items || []).map((it) => getProductSku(it.product) || "—"),
          ...(d.manualItems || []).map((mi) => mi.sku || ""),
        ].filter((x) => x !== undefined);

        const allNames = [
          ...(d.items || []).map((it) => getProductName(it.product)),
          ...(d.manualItems || []).map((mi) => mi.name || "פריט ידני"),
        ];

        const allQtys = [
          ...(d.items || []).map((it) => Number(it.quantity || 0)),
          ...(d.manualItems || []).map((mi) => Number(mi.quantity || 0)),
        ];

        rows.push({
          "לקוח": group.customerName,
          "תאריך": formatDate(d.date),
          "למי נופק": d.deliveredTo || "",
          "מקטים": allSKUs.join(", "),
          "מוצרים": allNames.join(", "),
          "כמויות": allQtys.join(", "),
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
      {/* כותרת + ייצוא */}
      <div className="dl-header">
        <h2>רשימת ניפוקים לפי לקוח</h2>
        <button className="dl-btn primary" onClick={exportToExcel}>ייצוא לאקסל</button>
      </div>

      {/* סינון לקוח */}
      <div className="dl-filter">
        <label>סנן לפי לקוח:</label>
        <select className="dl-select" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
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

          {group.deliveries.map((delivery, idx) => (
            <div key={delivery._id || delivery.id || idx} className="dl-card">
              <div className="dl-card-row"><span>תאריך:</span> {formatDate(delivery.date)}</div>
              <div className="dl-card-row"><span>למי נופק:</span> {delivery.deliveredTo || "—"}</div>

              <div className="dl-card-row">
                <span>פריטים:</span>
                <ItemsMiniTable
                  catalogItems={delivery.items}
                  manualItems={delivery.manualItems}
                  getName={getProductName}
                  getSku={getProductSku}
                />
              </div>

              <div className="dl-card-actions">
                {delivery.signature ? (
                  <button className="dl-icon-btn" onClick={() => handleDownloadReceipt(delivery._id || delivery.id)} title="הורד קבלה PDF">
                    <PictureAsPdfIcon style={{ color: "red" }} />
                  </button>
                ) : (
                  <span>—</span>
                )}
                <button className="dl-btn secondary" onClick={() => handleCredit(delivery)}>
                  <UndoIcon style={{ marginLeft: 6 }} />
                  זיכוי
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* מודאל: טופס זיכוי ממולא מראש */}
      {showReturnModal && (
        <div className="modal-backdrop" onClick={() => setShowReturnModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="modal-header">
              <h3>זיכוי מלאי (מניפוק קיים)</h3>
              <button className="close-btn" onClick={() => setShowReturnModal(false)} aria-label="סגור">
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <AddReturn
                onCreated={() => setShowReturnModal(false)}
                prefill={prefillForReturn}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
