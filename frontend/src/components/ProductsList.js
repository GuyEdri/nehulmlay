// frontend/src/components/ProductsList.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api";
import UpdateStock from "./UpdateStock";
import ProductHistory from "./ProductHistory";

import {
  Box, Typography, TextField, IconButton, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Stack, useMediaQuery
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import InventoryIcon from "@mui/icons-material/Inventory";
import { useTheme } from "@mui/material/styles";

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const noResults = useMemo(() => !loading && products.length === 0, [loading, products]);

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
          placeholder="חפש מוצר..."
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
            return (
              <Paper key={id} elevation={2} sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                  <Stack spacing={0.3} sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InventoryIcon fontSize="small" />
                      <Typography fontWeight="bold">{p.name}</Typography>
                    </Stack>
                    {p.description && (
                      <Typography variant="body2" color="text.secondary">
                        {p.description}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      כמות במלאי: <b>{p.stock}</b>
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <UpdateStock productId={id} onUpdate={fetchProducts} />
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
                <TableCell align="right" sx={{ width: "20%" }}>שם</TableCell>
                <TableCell align="right" sx={{ width: "35%" }}>תיאור</TableCell>
                <TableCell align="right" sx={{ width: "10%" }}>כמות</TableCell>
                <TableCell align="right" sx={{ width: "20%" }}>עדכון מלאי</TableCell>
                <TableCell align="right" sx={{ width: "10%" }}>היסטוריה</TableCell>
                <TableCell align="right" sx={{ width: "5%" }}>מחיקה</TableCell>
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
                return (
                  <React.Fragment key={id}>
                    <TableRow hover>
                      <TableCell align="right">{p.name}</TableCell>
                      <TableCell align="right" sx={{ color: "text.secondary" }}>
                        {p.description}
                      </TableCell>
                      <TableCell align="right"><b>{p.stock}</b></TableCell>
                      <TableCell align="right">
                        <UpdateStock productId={id} onUpdate={fetchProducts} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => handleShowHistory(id)}>
                          {selectedProduct === id ? "הסתר" : "הצג היסטוריה"}
                        </Button>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleDelete(id)} color="error">
                          <DeleteIcon />
                        </IconButton>
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

