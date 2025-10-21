// frontend/src/components/DeliveriesList.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Divider, FormControl, InputLabel, Select, MenuItem,
  IconButton
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { api } from "../api";

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

// טבלת פריטים מינימלית (מימין לשמאל)
function ItemsMiniTable({ items, getName, getSku }) {
  if (!Array.isArray(items) || items.length === 0)
    return <Typography variant="body2" color="text.secondary">—</Typography>;

  return (
    <Table size="small" sx={{ direction: "rtl" }} dir="rtl">
      <TableHead>
        <TableRow>
          <TableCell align="right">מקט</TableCell>
          <TableCell align="right">שם מוצר</TableCell>
          <TableCell align="right">כמות</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((it, i) => (
          <TableRow key={i}>
            <TableCell align="right">{getSku(it.product) || "—"}</TableCell>
            <TableCell align="right">{getName(it.product)}</TableCell>
            <TableCell align="right">{it.quantity}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function DeliveriesList() {
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [delsRes, prodsRes] = await Promise.all([
          api.get("/api/deliveries"),
          api.get("/api/products"),
        ]);
        if (!mounted) return;
        setDeliveries(Array.isArray(delsRes.data) ? delsRes.data : []);
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
      } catch {
        if (!mounted) return;
        setDeliveries([]);
        setProducts([]);
      }
    })();
    return () => { mounted = false; };
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
    <Box
      sx={{
        direction: "rtl",
        p: 3,
        maxWidth: 1000,
        margin: "auto",
        textAlign: "right",
        fontFamily: "Arial, sans-serif",
      }}
      dir="rtl"
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" fontWeight="bold">
          רשימת ניפוקים לפי לקוח
        </Typography>
        <Button variant="contained" color="primary" onClick={exportToExcel}>
          ייצוא לאקסל
        </Button>
      </Stack>

      <FormControl sx={{ minWidth: 220, mb: 2, textAlign: "right" }} dir="rtl">
        <InputLabel id="customer-filter-label">סנן לפי לקוח</InputLabel>
        <Select
          labelId="customer-filter-label"
          value={selectedCustomer}
          label="סנן לפי לקוח"
          onChange={(e) => setSelectedCustomer(e.target.value)}
          sx={{ direction: "rtl", textAlign: "right" }}
          dir="rtl"
        >
          <MenuItem value="">הצג הכל</MenuItem>
          {customerOptions.map((cn) => (
            <MenuItem value={cn} key={cn}>
              {cn}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ mb: 2 }} />

      {groupedAndSorted.map((group) => (
        <Box key={group.customerName} mb={4} sx={{ textAlign: "right" }} dir="rtl">
          <Typography variant="h6" color="primary" mb={1}>
            {group.customerName}
          </Typography>

          <TableContainer component={Paper} elevation={2} sx={{ direction: "rtl" }} dir="rtl">
            <Table sx={{ direction: "rtl" }} dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell align="right">תאריך</TableCell>
                  <TableCell align="right">למי נופק</TableCell>
                  <TableCell align="right">פריטים (מקט | שם מוצר | כמות)</TableCell>
                  <TableCell align="right">חתימה</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.deliveries.map((delivery, idx) => {
                  const key = delivery._id || delivery.id || `${group.customerName}-${idx}`;
                  return (
                    <TableRow key={key} hover>
                      <TableCell align="right">{formatDate(delivery.date)}</TableCell>
                      <TableCell align="right">{delivery.deliveredTo || "—"}</TableCell>
                      <TableCell align="right" sx={{ p: 1 }}>
                        <ItemsMiniTable
                          items={delivery.items}
                          getName={getProductName}
                          getSku={getProductSku}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {delivery.signature ? (
                          <IconButton onClick={() => handleDownloadReceipt(delivery._id || delivery.id)}>
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
          לא נמצאו ניפוקים
        </Typography>
      )}
    </Box>
  );
}

