// frontend/src/components/DeliveriesList.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Divider, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import IconButton from '@mui/material/IconButton';
import { api } from "../api";

// עוזרים להמרת תאריך מכל פורמט נפוץ
const toDate = (date) => {
  try {
    if (!date) return null;
    // Firestore Timestamp (seconds/nanoseconds או _seconds/_nanoseconds)
    if (typeof date === "object") {
      const sec = date.seconds ?? date._seconds;
      const nsec = date.nanoseconds ?? date._nanoseconds ?? 0;
      if (typeof sec === "number") {
        return new Date(sec * 1000 + Math.floor(nsec / 1e6));
      }
    }
    // ISO/string/number
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

  // מפה לשמות מוצרים ל־O(1)
  const productNameMap = useMemo(() => {
    const m = new Map();
    products.forEach(p => m.set(String(p._id || p.id), p.name));
    return m;
  }, [products]);

  const getProductName = (id) => productNameMap.get(String(id)) || String(id);

  // רשימת לקוחות לבחירה
  const customerOptions = useMemo(
    () => _.uniq(deliveries.map(d => d.customerName).filter(Boolean)).sort(),
    [deliveries]
  );

  // סינון לפי לקוח (אם נבחר)
  const filteredDeliveries = useMemo(
    () => (selectedCustomer
      ? deliveries.filter(d => d.customerName === selectedCustomer)
      : deliveries),
    [deliveries, selectedCustomer]
  );

  // קיבוץ לפי לקוח ומיון פנימי לפי תאריך יורד
  const groupedAndSorted = useMemo(() => {
    return _(filteredDeliveries)
      .groupBy(d => d.customerName || "ללא שם לקוח")
      .map((items, customerName) => ({
        customerName,
        deliveries: _.orderBy(
          items,
          d => (toDate(d?.date)?.getTime() ?? 0),
          ["desc"]
        ),
      }))
      .orderBy('customerName', ['asc'])
      .value();
  }, [filteredDeliveries]);

  // הורדת קבלה PDF
  const handleDownloadReceipt = async (deliveryId) => {
    try {
      const res = await api.post(
        `/api/deliveries/${deliveryId}/receipt`,
        {},
        { responseType: "blob" }
      );
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

  // ייצוא לאקסל
  const exportToExcel = () => {
    const rows = [];
    groupedAndSorted.forEach(group => {
      group.deliveries.forEach(d => {
        rows.push({
          "לקוח": group.customerName,
          "תאריך": formatDate(d.date),
          "למי נופק": d.deliveredTo || "",
          "מוצרים": Array.isArray(d.items)
            ? d.items.map(item => `${item.quantity} x ${getProductName(item.product)}`).join(", ")
            : "",
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
    <Box sx={{ direction: "rtl", p: 3, maxWidth: 900, margin: "auto", textAlign: "right" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" fontWeight="bold">רשימת ניפוקים לפי לקוח</Typography>
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
          onChange={e => setSelectedCustomer(e.target.value)}
          sx={{ direction: "rtl", textAlign: "right" }}
        >
          <MenuItem value="">הצג הכל</MenuItem>
          {customerOptions.map(cn =>
            <MenuItem value={cn} key={cn}>{cn}</MenuItem>
          )}
        </Select>
      </FormControl>

      <Divider sx={{ mb: 2, clear: "both" }} />

      {groupedAndSorted.map(group => (
        <Box key={group.customerName} mb={4}>
          <Typography variant="h6" color="primary" mb={1}>
            {group.customerName}
          </Typography>
          <TableContainer component={Paper} elevation={2}>
            <Table sx={{ direction: "rtl" }}>
              <TableHead>
                <TableRow>
                  <TableCell align="right">תאריך</TableCell>
                  <TableCell align="right">למי נופק</TableCell>
                  <TableCell align="right">מוצרים</TableCell>
                  <TableCell align="right">חתימה</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.deliveries.map((delivery, idx) => {
                  const key = delivery._id || delivery.id || `${group.customerName}-${idx}`;
                  const itemsText = Array.isArray(delivery.items)
                    ? delivery.items.map((item) =>
                        `${item.quantity} x ${getProductName(item.product)}`
                      ).join(", ")
                    : "";
                  return (
                    <TableRow key={key}>
                      <TableCell align="right">{formatDate(delivery.date)}</TableCell>
                      <TableCell align="right">{delivery.deliveredTo || "—"}</TableCell>
                      <TableCell align="right">{itemsText}</TableCell>
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

