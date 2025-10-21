// frontend/src/components/ReturnsList.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Divider, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import IconButton from "@mui/material/IconButton";
import { api } from "../api";

/* ---------- עזרי תאריך זהים ל-Deliveries ---------- */
const toDate = (date) => {
  try {
    if (!date) return null;
    // Firestore Timestamp
    if (typeof date === "object") {
      const sec = date.seconds ?? date._seconds;
      const nsec = date.nanoseconds ?? date._nanoseconds ?? 0;
      if (typeof sec === "number") {
        return new Date(sec * 1000 + Math.floor(nsec / 1e6));
      }
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

/* ---------- טבלת-מיני להצגת פריטי זיכוי ---------- */
function ItemsMiniTable({ items, getName, getSku }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }
  return (
    <Table size="small" sx={{ direction: "rtl" }}>
      <TableHead>
        <TableRow>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>מקט</TableCell>
          <TableCell align="right">שם מוצר</TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>כמות</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((it, i) => (
          <TableRow key={i}>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{getSku(it.product) || "—"}</TableCell>
            <TableCell align="right">{getName(it.product)}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{it.quantity}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ---------- הקומפוננטה הראשית ---------- */
export default function ReturnsList() {
  const [rows, setRows] = useState([]);       // כל הזיכויים
  const [products, setProducts] = useState([]); // לרזולוציית שם/מקט
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [retRes, prodRes] = await Promise.all([
          api.get("/api/returns"),
          api.get("/api/products"),
        ]);
        if (!mounted) return;
        setRows(Array.isArray(retRes.data) ? retRes.data : []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      } catch (e) {
        if (!mounted) return;
        console.error("Load returns/products failed:", e?.response?.data || e?.message);
        setRows([]);
        setProducts([]);
        setErr(e?.response?.data?.error || "שגיאה בטעינת נתונים");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // מיפוי מוצרים ל־O(1)
  const productMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(String(p._id || p.id), { name: p.name, sku: p.sku || "" });
    }
    return m;
  }, [products]);

  const getProductName = (id) => productMap.get(String(id))?.name || String(id);
  const getProductSku  = (id) => productMap.get(String(id))?.sku || "";

  // אופציות לקוח
  const customerOptions = useMemo(
    () => _.uniq(rows.map((r) => r.customerName).filter(Boolean)).sort(),
    [rows]
  );

  // סינון לפי לקוח (אם נבחר)
  const filteredRows = useMemo(
    () => (selectedCustomer ? rows.filter((r) => r.customerName === selectedCustomer) : rows),
    [rows, selectedCustomer]
  );

  // קיבוץ לפי לקוח + מיון תאריך יורד
  const groupedAndSorted = useMemo(() => {
    return _(filteredRows)
      .groupBy((r) => r.customerName || "ללא שם לקוח")
      .map((items, customerName) => ({
        customerName,
        returns: _.orderBy(items, (r) => toDate(r?.date)?.getTime() ?? 0, ["desc"]),
      }))
      .orderBy("customerName", ["asc"])
      .value();
  }, [filteredRows]);

  // הורדת אישור זיכוי PDF
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

  // ייצוא לאקסל
  const exportToExcel = () => {
    const rowsForXlsx = [];
    groupedAndSorted.forEach((group) => {
      group.returns.forEach((r) => {
        const itemSKUs  = Array.isArray(r.items) ? r.items.map(it => getProductSku(it.product) || "—").join(", ") : "";
        const itemNames = Array.isArray(r.items) ? r.items.map(it => getProductName(it.product)).join(", ") : "";
        const itemQtys  = Array.isArray(r.items) ? r.items.map(it => it.quantity).join(", ") : "";
        rowsForXlsx.push({
          "לקוח": group.customerName,
          "תאריך": formatDate(r.date),
          "הוחזר ע״י": r.returnedBy || "",
          "מחסן יעד": r.warehouseName || r.warehouseId || "",
          "מקטים": itemSKUs,
          "מוצרים": itemNames,
          "כמויות": itemQtys,
          "חתימה": r.signature ? "כן" : "לא",
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rowsForXlsx);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "זיכויים");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "returns.xlsx");
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 40 }}>טוען זיכויים...</div>;
  }
  if (err) {
    return <div style={{ color: "red", textAlign: "center", marginTop: 40 }}>{err}</div>;
  }
  if (rows.length === 0) {
    return <div style={{ textAlign: "center", marginTop: 40 }}>אין זיכויים להצגה</div>;
  }

  return (
    <Box sx={{ direction: "rtl", p: 3, maxWidth: 1000, margin: "auto", textAlign: "right" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" fontWeight="bold">רשימת זיכויים לפי לקוח</Typography>
        <Button variant="contained" color="primary" onClick={exportToExcel}>
          ייצוא לאקסל
        </Button>
      </Stack>

      <FormControl sx={{ minWidth: 220, mb: 2, float: "left" }}>
        <InputLabel id="customer-filter-label">סנן לפי לקוח</InputLabel>
        <Select
          labelId="customer-filter-label"
          value={selectedCustomer}
          label="סנן לפי לקוח"
          onChange={(e) => setSelectedCustomer(e.target.value)}
          sx={{ direction: "rtl", textAlign: "right" }}
        >
          <MenuItem value="">הצג הכל</MenuItem>
          {customerOptions.map((cn) => (
            <MenuItem value={cn} key={cn}>
              {cn}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ mb: 2, clear: "both" }} />

      {groupedAndSorted.map((group) => (
        <Box key={group.customerName} mb={4}>
          <Typography variant="h6" color="primary" mb={1}>
            {group.customerName}
          </Typography>

          <TableContainer component={Paper} elevation={2}>
            <Table sx={{ direction: "rtl" }}>
              <TableHead>
                <TableRow>
                  <TableCell align="right">תאריך</TableCell>
                  <TableCell align="right">הוחזר ע״י</TableCell>
                  <TableCell align="right">מחסן יעד</TableCell>
                  <TableCell align="right">פריטים (מקט | שם מוצר | כמות)</TableCell>
                  <TableCell align="right">חתימה</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.returns.map((ret, idx) => {
                  const key = ret._id || ret.id || `${group.customerName}-${idx}`;
                  return (
                    <TableRow key={key} hover>
                      <TableCell align="right">{formatDate(ret.date)}</TableCell>
                      <TableCell align="right">{ret.returnedBy || "—"}</TableCell>
                      <TableCell align="right">{ret.warehouseName || ret.warehouseId || "—"}</TableCell>
                      <TableCell align="right" sx={{ p: 1 }}>
                        <ItemsMiniTable
                          items={ret.items}
                          getName={getProductName}
                          getSku={getProductSku}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {ret.signature ? (
                          <IconButton onClick={() => handleDownloadReceipt(ret._id || ret.id)}>
                            <PictureAsPdfIcon color="error" />
                          </IconButton>
                        ) : (
                          <span>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {groupedAndSorted.length === 0 && (
        <Typography color="text.secondary" textAlign="center" mt={8}>
          לא נמצאו זיכויים
        </Typography>
      )}
    </Box>
  );
}

