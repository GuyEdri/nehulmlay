// frontend/src/components/ProductsList.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api";
import ProductHistory from "./ProductHistory";

import {
  Box, Typography, TextField, IconButton, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Stack, useMediaQuery, Tooltip, InputAdornment, FormControl, Select, MenuItem
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import InventoryIcon from "@mui/icons-material/Inventory";
import UpdateIcon from "@mui/icons-material/PublishedWithChanges";
import { useTheme } from "@mui/material/styles";

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  const [deltas, setDeltas] = useState({});
  const [rowBusy, setRowBusy] = useState({});

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const pid = (p) => String(p._id || p.id);

  // --- מחסנים ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/warehouses");
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("GET /api/warehouses failed:", e?.response?.status, e?.response?.data || e?.message);
        if (!mounted) return;
        setWarehouses([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const whMap = useMemo(() => {
    const m = new Map();
    (warehouses || []).forEach(w => {
      const id = String(w._id || w.id);
      m.set(id, w.name || "(ללא שם)");
    });
    return m;
  }, [warehouses]);

  const getWhName = (wid) => {
    if (!wid) return "ללא שיוך";
    const key = String(wid);
    return whMap.get(key) || key;
  };

  // --- טעינת מוצרים + סינון/חיפוש ---
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedWarehouse) params.warehouse = selectedWarehouse;
      if (search) params.search = search;
      const res = await api.get("/api/products", { params });
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
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
      console.error(err);
      alert("שגיאה בעדכון מלאי: " + (err?.response?.data?.error || err?.message));
    } finally {
      setRowBusy((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleChangeWarehouse = async (productId, newWarehouseId) => {
    try {
      setRowBusy((prev) => ({ ...prev, [productId]: true }));
      const patch = { warehouseId: newWarehouseId ? String(newWarehouseId) : "" };
      await api.put(`/api/products/${productId}`, patch);
      await fetchProducts();
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון המחסן: " + (err?.response?.data?.error || err?.message));
    } finally {
      setRowBusy((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const noResults = useMemo(() => !loading && products.length === 0, [loading, products]);

  // --- פקדי שינוי מלאי (מותאם RTL) ---
  const StockAdjustControls = ({ id }) => {
    const value = deltas[id] ?? "";
    const busy = !!rowBusy[id];

    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", justifyContent: { xs: "space-between", sm: "flex-start" } }}>
        <TextField
          size="small"
          type="number"
          value={value}
          onChange={(e) => setDelta(id, e.target.value)}
          placeholder="שינוי מלאי (למשל 5 או -3)"
          sx={{ width: { xs: "100%", sm: 200 } }}
          inputProps={{ style: { textAlign: "right" }, dir: "rtl" }}
          // ב־RTL עדיף האייקון בסוף
          InputProps={{ endAdornment: <InputAdornment position="end">Δ</InputAdornment> }}
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

  // --- תא בחירת מחסן (RTL מלא כולל התפריט) ---
  const WarehouseSelectCell = ({ value, onChange, disabled, fullWidth = false }) => {
    return (
      <FormControl size="small" sx={{ minWidth: fullWidth ? "100%" : 160, direction: "rtl" }} fullWidth={fullWidth}>
        <Select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          displayEmpty
          sx={{ direction: "rtl", textAlign: "right" }}
          MenuProps={{
            // RTL לתפריט עצמו
            PaperProps: { sx: { direction: "rtl" } },
            anchorOrigin: { vertical: "bottom", horizontal: "right" },
            transformOrigin: { vertical: "top", horizontal: "right" },
          }}
        >
          <MenuItem value="">ללא שיוך</MenuItem>
          {warehouses.map(w => (
            <MenuItem key={w._id || w.id} value={String(w._id || w.id)}>
              {w.name || "(ללא שם)"}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  return (
    <Box sx={{ direction: "rtl", textAlign: "right", p: { xs: 1.5, sm: 2 } }}>
      {/* פס עליון */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        mb={2}
      >
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1, textAlign: { xs: "center", sm: "right" } }}>
          רשימת מוצרים
        </Typography>

        <FormControl size="small" sx={{ minWidth: 180, direction: "rtl" }}>
          <Select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            displayEmpty
            sx={{ direction: "rtl", textAlign: "right" }}
            MenuProps={{
              PaperProps: { sx: { direction: "rtl" } },
              anchorOrigin: { vertical: "bottom", horizontal: "right" },
              transformOrigin: { vertical: "top", horizontal: "right" },
            }}
          >
            <MenuItem value="">
              <em>כל המחסנים</em>
            </MenuItem>
            {warehouses.map(w => (
              <MenuItem key={w._id || w.id} value={String(w._id || w.id)}>
                {w.name || "(ללא שם)"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="חפש מוצר בשם או במקט..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 280 } }}
          inputProps={{ style: { textAlign: "right" }, dir: "rtl" }}
        />
      </Stack>

      {/* מובייל — כרטיסים רספונסיביים */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Typography>טוען...</Typography>}
          {noResults && <Typography color="text.secondary">לא נמצאו מוצרים</Typography>}

          {products.map((p) => {
            const id = pid(p);
            const open = selectedProduct === id;
            const busy = !!rowBusy[id];

            return (
              <Paper
                key={id}
                elevation={1}
                sx={{
                  p: 1.25,
                  direction: "rtl",
                  "& *": { direction: "rtl" },
                }}
              >
                {/* כותרת הכרטיס */}
                <Stack spacing={0.5} sx={{ mb: 1 }}>
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
                </Stack>

                {/* שורה: מחסן + כמות */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>מחסן:</Typography>
                  <WarehouseSelectCell
                    value={p.warehouseId}
                    onChange={(wid) => handleChangeWarehouse(id, wid)}
                    disabled={busy}
                    fullWidth
                  />
                </Stack>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  כמות במלאי: <b>{busy ? "…" : p.stock}</b>
                </Typography>

                {/* שינוי מלאי */}
                <StockAdjustControls id={id} />

                {/* פעולות */}
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-start" sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShowHistory(id)}
                    startIcon={<HistoryIcon />}
                  >
                    {open ? "הסתר היסטוריה" : "הצג היסטוריה"}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(id)}
                  >
                    מחק
                  </Button>
                </Stack>

                {/* היסטוריה */}
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
        // דסקטופ — טבלה RTL מלאה
        <TableContainer component={Paper} elevation={2}>
          <Table dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell align="right" sx={{ width: "10%" }}>מקט</TableCell>
                <TableCell align="right" sx={{ width: "18%" }}>שם</TableCell>
                <TableCell align="right" sx={{ width: "26%" }}>תיאור</TableCell>
                <TableCell align="right" sx={{ width: "8%" }}>כמות</TableCell>
                <TableCell align="right" sx={{ width: "16%" }}>מחסן</TableCell>
                <TableCell align="right" sx={{ width: "22%" }}>שינוי מלאי (Δ)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">טוען...</TableCell>
                </TableRow>
              )}
              {noResults && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
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
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ direction: "rtl" }}>
                          <Typography variant="body2">{getWhName(p.warehouseId)}</Typography>
                          <WarehouseSelectCell
                            value={p.warehouseId}
                            onChange={(wid) => handleChangeWarehouse(id, wid)}
                            disabled={busy}
                          />
                        </Stack>
                      </TableCell>

                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ direction: "rtl" }}>
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
                        <TableCell colSpan={6} sx={{ background: "#fafafa" }}>
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
