// frontend/src/components/IssueStock.js
import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api";
import SimpleSignaturePad from "./SignaturePad";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  IconButton,
  Paper,
  Stack,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function IssueStock({ onIssued }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(""); // 👈 מחסן מקור
  const [allowNoWarehouse, setAllowNoWarehouse] = useState(false); // 👈 ניפוק ידני ללא מחסן
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");

  // item: { type: 'catalog'|'manual', product?, name?, sku?, quantity }
  const [items, setItems] = useState([{ type: "catalog", product: "", quantity: 1 }]);

  const [signature, setSignature] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // טוען מחסנים + לקוחות פעם אחת
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [whRes, custsRes] = await Promise.all([
          api.get("/api/warehouses"),
          api.get("/api/customers"),
        ]);
        if (!mounted) return;
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
        setCustomers(Array.isArray(custsRes.data) ? custsRes.data : []);
      } catch {
        if (!mounted) return;
        setWarehouses([]);
        setCustomers([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // טען מוצרים לפי מחסן (רק אם לא מצב ידני)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (allowNoWarehouse) {
          setProducts([]);
          return;
        }
        if (!warehouseId) {
          setProducts([]);
          return;
        }
        // שים לב: בפרויקטים קודמים השתמשת ב-query param בשם warehouse או warehouseId.
        // כאן אני משתמש ב-warehouseId לשמירה על התאימות לקובץ הזה כפי ששיתפת.
        const res = await api.get("/api/products", { params: { warehouseId } });
        if (!mounted) return;
        setProducts(Array.isArray(res.data) ? res.data : []);
        // איפוס בחירות פריטים מהקטלוג אם המחסן השתנה
        setItems((prev) =>
          prev.map((row) =>
            row.type === "catalog" ? { ...row, product: "", quantity: 1 } : row
          )
        );
      } catch {
        if (!mounted) return;
        setProducts([]);
      }
    })();
    return () => { mounted = false; };
  }, [warehouseId, allowNoWarehouse]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "he")
    );
  }, [products]);

  const handleItemField = (idx, field, value) => {
    setItems((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addCatalogItem = () =>
    setItems((rows) => [...rows, { type: "catalog", product: "", quantity: 1 }]);

  const addManualItem = () =>
    setItems((rows) => [...rows, { type: "manual", name: "", sku: "", quantity: 1 }]);

  const removeItem = (idx) =>
    setItems((rows) => rows.filter((_, i) => i !== idx));

  const isValidSignature = (sig) =>
    typeof sig === "string" && sig.startsWith("data:image") && sig.length > 100;

  const handleToggleNoWarehouse = (e) => {
    const next = !!e.target.checked;
    setAllowNoWarehouse(next);
    if (next) {
      // במצב ידני — אין מחסן, ואין מוצרים מהקטלוג
      setWarehouseId("");
      setProducts([]);
      setItems([{ type: "manual", name: "", sku: "", quantity: 1 }]);
    } else {
      // חזרה למצב רגיל
      setItems([{ type: "catalog", product: "", quantity: 1 }]);
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // ולידציה כללית
    if (!customer || !String(customer).trim()) {
      setError("יש לבחור לקוח");
      return;
    }
    if (!deliveredTo.trim()) {
      setError("יש להזין שם למי נופק");
      return;
    }
    if (!personalNumber.trim()) {
      setError("יש להזין מספר אישי");
      return;
    }
    if (
      items.length === 0 ||
      items.some((i) => !i.quantity || Number.isNaN(Number(i.quantity)) || Number(i.quantity) < 1)
    ) {
      setError("יש למלא כמות חוקית (>=1) בכל שורה");
      return;
    }

    // אם לא מצב ידני מלא — נדרוש בחירת מחסן
    if (!allowNoWarehouse && !warehouseId) {
      setError("יש לבחור מחסן ממנו ינופק המלאי");
      return;
    }

    // בדיקת פריט לפי סוג
    if (allowNoWarehouse) {
      // במצב "ללא מחסן" — כל השורות חייבות להיות ידניות
      if (items.some((i) => i.type !== "manual")) {
        setError("במצב 'ניפוק ללא מחסן' מותרות רק שורות ידניות.");
        return;
      }
      // ולידציית שורה ידנית
      for (const row of items) {
        if (!row.name || !row.name.trim()) {
          setError("בפריט ידני יש למלא 'שם פריט'.");
          return;
        }
      }
    } else {
      // מצב רגיל — אפשר לערבב, אבל בקטלוג נבדוק מלאי מול המחסן
      const productMap = new Map(products.map((p) => [String(p._id || p.id), p]));
      for (const row of items) {
        if (row.type === "catalog") {
          if (!row.product) {
            setError("בחר מוצר עבור כל שורת קטלוג.");
            return;
          }
          const p = productMap.get(String(row.product));
          if (!p) {
            setError("נבחר מוצר לא תקין עבור המחסן הזה");
            return;
          }
          if (Number(row.quantity) > Number(p.stock || 0)) {
            setError(`הכמות המבוקשת למוצר "${p.name}" גבוהה מהמלאי הקיים`);
            return;
          }
        } else if (row.type === "manual") {
          if (!row.name || !row.name.trim()) {
            setError("בפריט ידני יש למלא 'שם פריט'.");
            return;
          }
        }
      }
    }

    if (!isValidSignature(signature)) {
      setError("יש להזין חתימה דיגיטלית תקינה");
      return;
    }

    try {
      setLoading(true);

      // בניית פריטים לבקשה
      const cleanItems = items.map((i) => {
        const qty = Number(i.quantity);
        if (i.type === "manual") {
          return {
            manual: true,
            name: String(i.name || "").trim(),
            sku: String(i.sku || "").trim(),
            quantity: qty,
          };
        }
        return {
          product: String(i.product),
          quantity: qty,
        };
      });

      const selectedCustomerObj = customers.find(
        (c) => String(c._id || c.id) === String(customer)
      );
      const customerName = selectedCustomerObj ? selectedCustomerObj.name : "";

      const body = {
        warehouseId: allowNoWarehouse ? "" : warehouseId,
        noWarehouse: !!allowNoWarehouse, // דגל עזר לצד שרת (אופציונלי)
        items: cleanItems,
        signature,
        deliveredTo,
        customer: String(customer),
        customerName,
        personalNumber: personalNumber.trim(),
      };

      await api.post("/api/deliveries", body);

      setSuccess("ניפוק בוצע בהצלחה");
      setWarehouseId("");
      setCustomer("");
      setDeliveredTo("");
      setPersonalNumber("");
      setItems([{ type: allowNoWarehouse ? "manual" : "catalog", ...(allowNoWarehouse ? { name: "", sku: "" } : { product: "" }), quantity: 1 }]);
      setSignature(null);
      if (onIssued) onIssued();
    } catch (err) {
      setError(err?.response?.data?.error || "שגיאה בניפוק");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>חטיבה 551</h1>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 800,
          margin: "auto",
          direction: "rtl",
          textAlign: "right",
          position: "relative",
        }}
      >
        <Typography variant="h5" mb={3} fontWeight="bold" textAlign="center">
          ניפוק מלאי ללקוח
        </Typography>

        <form onSubmit={handleIssue}>
          <Stack spacing={3}>
            {/* מצב ידני */}
            <FormControlLabel
              control={
                <Switch
                  checked={allowNoWarehouse}
                  onChange={handleToggleNoWarehouse}
                  color="primary"
                />
              }
              label="ניפוק ללא מחסן (ידני)"
            />

            {!allowNoWarehouse && (
              <FormControl fullWidth required>
                <InputLabel id="warehouse-select-label">בחר מחסן</InputLabel>
                <Select
                  labelId="warehouse-select-label"
                  value={warehouseId}
                  label="בחר מחסן"
                  onChange={(e) => setWarehouseId(e.target.value)}
                  sx={{ direction: "rtl", textAlign: "right" }}
                >
                  {warehouses.map((w) => (
                    <MenuItem key={w._id || w.id} value={String(w._id || w.id)}>
                      {w.name || "(ללא שם)"}{w.address ? ` — ${w.address}` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* לקוח */}
            <FormControl fullWidth required>
              <InputLabel id="customer-select-label">בחר לקוח</InputLabel>
              <Select
                labelId="customer-select-label"
                value={customer}
                label="בחר לקוח"
                onChange={(e) => setCustomer(e.target.value)}
                sx={{ direction: "rtl", textAlign: "right" }}
              >
                {customers.map((c) => (
                  <MenuItem key={c._id || c.id} value={String(c._id || c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="שם למי נופק"
              value={deliveredTo}
              onChange={(e) => setDeliveredTo(e.target.value)}
              required
              fullWidth
              sx={{ direction: "rtl", textAlign: "right" }}
              inputProps={{ style: { textAlign: "right" } }}
            />

            <TextField
              label="מספר אישי"
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              required
              fullWidth
              sx={{ direction: "rtl", textAlign: "right" }}
              inputProps={{ style: { textAlign: "right" } }}
            />

            <Divider />

            {/* שורות פריטים */}
            {items.map((item, idx) => (
              <Stack
                key={idx}
                spacing={2}
                sx={{ p: 2, border: "1px solid #eee", borderRadius: 2 }}
              >
                <Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between">
                  <Typography fontWeight={600}>
                    פריט #{idx + 1} — {item.type === "manual" ? "ידני" : "קטלוג"}
                  </Typography>
                  {items.length > 1 && (
                    <IconButton color="error" onClick={() => removeItem(idx)}>
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Stack>

                {item.type === "catalog" ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControl sx={{ flex: 1 }} required disabled={allowNoWarehouse || !warehouseId}>
                      <InputLabel id={`product-select-label-${idx}`}>בחר מוצר</InputLabel>
                      <Select
                        labelId={`product-select-label-${idx}`}
                        value={item.product ? String(item.product) : ""}
                        label="בחר מוצר"
                        onChange={(e) => handleItemField(idx, "product", e.target.value)}
                        sx={{ direction: "rtl", textAlign: "right" }}
                      >
                        {sortedProducts.map((p) => (
                          <MenuItem key={p._id || p.id} value={String(p._id || p.id)}>
                            {p.sku ? `[${p.sku}] ` : ""}{p.name} (במלאי: {p.stock})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="כמות"
                      type="number"
                      inputProps={{ min: 1, style: { textAlign: "right" } }}
                      value={item.quantity}
                      onChange={(e) => handleItemField(idx, "quantity", e.target.value)}
                      required
                      sx={{ width: 160 }}
                      disabled={allowNoWarehouse || !warehouseId}
                    />
                  </Stack>
                ) : (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="שם פריט (ידני)"
                      value={item.name || ""}
                      onChange={(e) => handleItemField(idx, "name", e.target.value)}
                      required
                      sx={{ flex: 1 }}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      label="מקט (אופציונלי)"
                      value={item.sku || ""}
                      onChange={(e) => handleItemField(idx, "sku", e.target.value)}
                      sx={{ width: 240 }}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      label="כמות"
                      type="number"
                      inputProps={{ min: 1, style: { textAlign: "right" } }}
                      value={item.quantity}
                      onChange={(e) => handleItemField(idx, "quantity", e.target.value)}
                      required
                      sx={{ width: 160 }}
                    />
                  </Stack>
                )}
              </Stack>
            ))}

            <Stack direction="row" spacing={2} justifyContent="flex-start">
              <Button variant="outlined" onClick={addManualItem}>
                הוסף פריט ידני
              </Button>
              <Button
                variant="outlined"
                onClick={addCatalogItem}
                disabled={allowNoWarehouse}
              >
                הוסף פריט מקטלוג
              </Button>
            </Stack>

            {/* חתימה */}
            <Box style={{ textAlign: "right" }}>
              <Typography mb={1}>חתימה דיגיטלית (חובה)</Typography>
              <SimpleSignaturePad onEnd={setSignature} />
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="success"
              fullWidth
              size="large"
              sx={{ fontWeight: "bold" }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "נפק"}
            </Button>

            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
          </Stack>
        </form>
      </Paper>
    </div>
  );
}
