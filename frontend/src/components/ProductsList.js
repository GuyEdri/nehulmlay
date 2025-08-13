// frontend/src/components/ProductsList.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api";
import ProductHistory from "./ProductHistory";

import {
  Box, Typography, TextField, IconButton, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Stack, useMediaQuery, Tooltip, InputAdornment
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import InventoryIcon from "@mui/icons-material/Inventory";
import UpdateIcon from "@mui/icons-material/PublishedWithChanges";
import { useTheme } from "@mui/material/styles";

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // ערך שינוי לכל מוצר (יכול להיות שלילי/חיובי)
  const [deltas, setDeltas] = useState({}); // { [productId]: string }
  const [rowBusy, setRowBusy] = useState({}); // אינדיקציית טעינה לשורה

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // <600px

  const pid = (p) => String(p._id || p.id);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/products", { params: { search } });
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
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
      // שימוש בראוט הקיים: PUT /api/products/:id/stock  עם { diff }
      await api.put(`/api/products/${productId}/stock`, { diff: deltaNum });
      setDelta(productId, "");   // איפוס השדה אחרי הצלחה
      await fetchProducts();     // רענון הנתונים
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון מלאי: " + (err?.response?.data?.error || err?.message));
    } finally {
      setRowBusy((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const noResults = useMemo(() => !loading && products.length === 0, [loading, products]);

  const StockAdjustControls = ({ id }) => {
    const value = deltas[id] ?? "";
    const busy = !!rowBusy[id];

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          type="number"
          value={value}
          onChange={(e) => setDelta(id, e.target.value)}
          placeholder="שינוי מלאי (למשל 5 או -3)"
          sx={{ width: 180 }}
          inputProps={{ style: { textAlign: "center" } }}
          InputProps={{ startAdornment: <InputAdornment position="start">Δ</InputAdornment> }}
          disabled={busy}
        />
        <Tooltip title="עדכן מלאי (תוספת/הפחתה)">
          <span>
            <Button
              size="small"
              variant="contained"
              onClick={() => handleAdjustStock(id)}
              startIcon={<UpdateIcon />}
              disabled={busy}
            >
              עדכן
            </Button>
          </span>
        </Tooltip>
      </Stack>
    );
  };

  return (
    <Box sx={{ direction: "rtl", textAlign: "right", p: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        mb={2}
      >
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>
          רשימת מוצרים
        </Typography>
        <TextField
          size="small"
          placeholder="חפש מוצר בשם או במקט..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 280 } }}
          inputProps={{ style: { textAlign: "right" } }}
        />
      </Stack>

      {/* מובייל: כרטיסים; דסקטופ: טבלה */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Typography>טוען...</Typography>}
          {noResults && <Typography color="text.secondary">לא נמצאו מוצרים</Typography>}

          {products.map((p) => {
            const id = pid(p);
            const open = selectedProduct === id;
            const busy = !!rowBusy[id];

            return (
              <Paper key={id} elevation={2} sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                  <Stack spacing={0.3} sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InventoryIcon fontSize="small" />
                      <Typography fontWeight="bold">{p.name}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      מקט: <b>{p.sku || "—"}</b>
                    </Typography>
                    {p.description && (
                      <Typography variant="body2" color="text.secondary">
                        {p.description}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      כמות במלאי: <b>{busy ? "…" : p.stock}</b>
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label="היסטוריה" onClick={() => handleShowHistory(id)} size="small">
                      <HistoryIcon />
                    </IconButton>
                    <IconButton
                      aria-label="מחק"
                      onClick={() => handleDelete(id)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1 }} />
                <StockAdjustControls id={id} />

                {open && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <ProductHistory productId={id} />
                  </>
                )}
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="right" sx={{ width: "10%" }}>מקט</TableCell>
                <TableCell align="right" sx={{ width: "20%" }}>שם</TableCell>
                <TableCell align="right" sx={{ width: "32%" }}>תיאור</TableCell>
                <TableCell align="right" sx={{ width: "10%" }}>כמות</TableCell>
                <TableCell align="right" sx={{ width: "28%" }}>שינוי מלאי (Δ)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">טוען...</TableCell>
                </TableRow>
              )}
              {noResults && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                    לא נמצאו מוצרים
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => {
                const id = pid(p);
                const busy = !!rowBusy[id];

                return (
                  <React.Fragment key={id}>
                    <TableRow hover>
                      <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                        {p.sku || "—"}
                      </TableCell>
                      <TableCell align="right">{p.name}</TableCell>
                      <TableCell align="right" sx={{ color: "text.secondary" }}>
                        {p.description}
                      </TableCell>
                      <TableCell align="right"><b>{busy ? "…" : p.stock}</b></TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <StockAdjustControls id={id} />
                          <Tooltip title={selectedProduct === id ? "הסתר היסטוריה" : "הצג היסטוריה"}>
                            <Button size="small" onClick={() => handleShowHistory(id)}>
                              {selectedProduct === id ? "הסתר היסטוריה" : "הצג היסטוריה"}
                            </Button>
                          </Tooltip>
                          <Tooltip title="מחק מוצר">
                            <IconButton onClick={() => handleDelete(id)} color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>

                    {selectedProduct === id && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ background: "#fafafa" }}>
                          <ProductHistory productId={id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

