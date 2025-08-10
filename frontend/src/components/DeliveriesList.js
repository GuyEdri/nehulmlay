import React, { useEffect, useState } from "react";
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Divider, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import _ from "lodash";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import IconButton from '@mui/material/IconButton';

// שימוש ב-client המשותף
import { api } from "../api";

export default function DeliveriesList() {
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(""); // לקוח שנבחר לפילטר

  useEffect(() => {
    // טען ניפוקים ומוצרים
    Promise.all([
      api.get("/api/deliveries"),
      api.get("/api/products"),
    ])
      .then(([delsRes, prodsRes]) => {
        setDeliveries(Array.isArray(delsRes.data) ? delsRes.data : []);
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
      })
      .catch(() => {
        setDeliveries([]);
        setProducts([]);
      });
  }, []);

  const getProductName = (id) => {
    const product = products.find(p => String(p._id || p.id) === String(id));
    return product ? product.name : id;
  };

  const formatDate = (date) => {
    if (!date) return "";
    if (typeof date === "string" || typeof date === "number") {
      try { return new Date(date).toLocaleString('he-IL'); }
      catch { return ""; }
    }
    if (date.seconds) {
      try { return new Date(date.seconds * 1000).toLocaleString('he-IL'); }
      catch { return ""; }
    }
    return "";
  };

  // כפתור להורדת קבלה PDF
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

  // כל הלקוחות הקיימים ברשימה (ל-drop down)
  const customerOptions = _.uniq(deliveries.map(d => d.customerName)).filter(Boolean);

  // סינון לפי לקוח שנבחר (או הכל)
  const filteredDeliveries = selectedCustomer
    ? deliveries.filter(d => d.customerName === selectedCustomer)
    : deliveries;

  // קיבוץ ומיון לפי לקוח ותאריך
  const groupedAndSorted = _(filteredDeliveries)
    .groupBy('customerName')
    .map((items, customerName) => ({
      customerName,
      deliveries: _.orderBy(
        items,
        d => (d?.date?.seconds ? d.date.seconds * 1000 : (new Date(d.date).getTime() || 0)),
        ['desc']
      )
    }))
    .orderBy('customerName', ['asc'])
    .value();

  // ייצוא לאקסל
  const exportToExcel = () => {
    const allRows = [];
    groupedAndSorted.forEach(group => {
      group.deliveries.forEach(d => {
        allRows.push({
          'לקוח': group.customerName,
          'תאריך': formatDate(d.date),
          'למי נופק': d.deliveredTo,
          'מוצרים': d.items.map(item => `${item.quantity} x ${getProductName(item.product)}`).join(', '),
          'חתימה': d.signature ? 'כן' : 'לא'
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(allRows);
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
                {group.deliveries.map((delivery, idx) => (
                  <TableRow key={delivery._id || delivery.id || idx}>
                    <TableCell align="right">
                      {formatDate(delivery.date)}
                    </TableCell>
                    <TableCell align="right">{delivery.deliveredTo}</TableCell>
                    <TableCell align="right">
                      {delivery.items.map((item, i) =>
                        <span key={i}>{item.quantity} x {getProductName(item.product)}</span>
                      ).reduce((prev, curr) => [prev, ', ', curr])}
                    </TableCell>
                    <TableCell align="right">
                      {delivery.signature
                        ? (
                          <IconButton onClick={() => handleDownloadReceipt(delivery._id || delivery.id)}>
                            <PictureAsPdfIcon color="error" />
                          </IconButton>
                        )
                        : <span>—</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
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

