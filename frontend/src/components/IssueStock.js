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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function IssueStock({ onIssued }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(""); // 👈 מחסן מקור
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");
  const [items, setItems] = useState([{ product: "", quantity: 1 }]);
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

  // טען מוצרים לפי מחסן
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!warehouseId) {
          setProducts([]);
          return;
        }
        const res = await api.get("/api/products", { params: { warehouseId } });
        if (!mounted) return;
        setProducts(Array.isArray(res.data) ? res.data : []);
        // איפוס בחירות מוצרים אם המחסן השתנה
        setItems([{ product: "", quantity: 1 }]);
      } catch {
        if (!mounted) return;
        setProducts([]);
      }
    })();
    return () => { mounted = false; };
  }, [warehouseId]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "he")
    );
  }, [products]);

  const handleItemChange = (idx, field, value) => {
    const newItems = [...items];
    newItems[idx][field] = value;
    setItems(newItems);
  };

  const handleAddItem = () =>
    setItems([...items, { product: "", quantity: 1 }]);

  const handleRemoveItem = (idx) =>
    setItems(items.filter((_, i) => i !== idx));

  const isValidSignature = (sig) =>
    typeof sig === "string" && sig.startsWith("data:image") && sig.length > 100;

  const handleIssue = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!warehouseId) {
      setError("יש לבחור מחסן ממנו ינופק המלאי");
      return;
    }
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
      items.some(
        (i) =>
          !i.product ||
          !i.quantity ||
          Number.isNaN(Number(i.quantity)) ||
          Number(i.quantity) < 1
      )
    ) {
      setError("יש לבחור מוצר ולמלא כמות חוקית בכל שורה");
      return;
    }
    if (!isValidSignature(signature)) {
      setError("יש להזין חתימה דיגיטלית תקינה");
      return;
    }

    // בדיקת כמות מול מלאי (קליינט)
    const productMap = new Map(products.map((p) => [String(p._id || p.id), p]));
    for (const row of items) {
      const p = productMap.get(String(row.product));
      if (!p) {
        setError("נבחר מוצר לא תקין עבור המחסן הזה");
        return;
      }
      if (Number(row.quantity) > Number(p.stock || 0)) {
        setError(`הכמות המבוקשת למוצר "${p.name}" גבוהה מהמלאי הקיים`);
        return;
      }
    }

    try {
      setLoading(true);

      const cleanItems = items.map((i) => ({
        product: String(i.product),
        quantity: Number(i.quantity),
      }));

      const selectedCustomerObj = customers.find(
        (c) => String(c._id || c.id) === String(customer)
      );
      const customerName = selectedCustomerObj ? selectedCustomerObj.name : "";

      const body = {
        warehouseId, // 👈 נשלח לשרת
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
      setItems([{ product: "", quantity: 1 }]);
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
          maxWidth: 700,
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
            {/* מחסן מקור */}
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

            {/* שורות פריטים */}
            {items.map((item, idx) => (
              <Stack
                key={idx}
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent="space-between"
              >
                <FormControl sx={{ flex: 1 }} required disabled={!warehouseId}>
                  <InputLabel id={`product-select-label-${idx}`}>בחר מוצר</InputLabel>
                  <Select
                    labelId={`product-select-label-${idx}`}
                    value={item.product ? String(item.product) : ""}
                    label="בחר מוצר"
                    onChange={(e) => handleItemChange(idx, "product", e.target.value)}
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
                  onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                  required
                  sx={{ width: 120 }}
                  disabled={!warehouseId}
                />

                {items.length > 1 && (
                  <IconButton color="error" onClick={() => handleRemoveItem(idx)}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
            ))}

            <Button variant="outlined" onClick={handleAddItem} disabled={!warehouseId}>
              הוסף מוצר נוסף
            </Button>

            {/* חתימה */}
            <Box>
              <Typography mb={1}>חתימה דיגיטלית (חובה):</Typography>
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

