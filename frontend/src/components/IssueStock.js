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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [prodsRes, custsRes] = await Promise.all([
          api.get("/api/products"),
          api.get("/api/customers"),
        ]);
        if (!mounted) return;
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
        setCustomers(Array.isArray(custsRes.data) ? custsRes.data : []);
      } catch {
        if (!mounted) return;
        setProducts([]);
        setCustomers([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

    // בדיקת כמות מול מלאי
    const productMap = new Map(
      products.map((p) => [String(p._id || p.id), p])
    );
    for (const row of items) {
      const p = productMap.get(String(row.product));
      if (p && Number(row.quantity) > Number(p.stock || 0)) {
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

      // שליפת שם הלקוח לפי ה-ID
      const selectedCustomerObj = customers.find(
        (c) => String(c._id || c.id) === String(customer)
      );
      const customerName = selectedCustomerObj ? selectedCustomerObj.name : "";

      const body = {
        items: cleanItems,
        signature,
        deliveredTo,
        customer: String(customer),
        customerName,
        personalNumber: personalNumber.trim(),
      };

      await api.post("/api/deliveries", body);

      setSuccess("ניפוק בוצע בהצלחה");
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
    <Box 
      dir="ltr" 
      sx={{ 
        direction: "ltr",
        textAlign: "left",
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif"
      }}
    >
      <Typography 
        variant="h3" 
        component="h1"
        sx={{ 
          textAlign: "center", 
          mb: 3,
          fontWeight: "bold",
          color: "#1976d2"
        }}
      >
        חטיבה 551
      </Typography>
      
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 700,
          margin: "auto",
          direction: "ltr",
          textAlign: "left",
        }}
      >
        <Typography
          variant="h5"
          mb={3}
          fontWeight="bold"
          textAlign="center"
          dir="ltr"
        >
          ניפוק מלאי ללקוח
        </Typography>

        <form onSubmit={handleIssue} dir="ltr">
          <Stack spacing={3} dir="ltr">
            <FormControl fullWidth required dir="ltr">
              <InputLabel
                id="customer-select-label"
                sx={{ 
                  left: 14,
                  right: "auto",
                  transformOrigin: "left"
                }}
              >
                בחר לקוח
              </InputLabel>
              <Select
                labelId="customer-select-label"
                id="customer-select"
                name="customer"
                value={customer}
                label="בחר לקוח"
                onChange={(e) => setCustomer(e.target.value)}
                sx={{ 
                  "& .MuiSelect-select": {
                    textAlign: "left",
                    direction: "ltr"
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    textAlign: "left"
                  }
                }}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  PaperProps: {
                    sx: {
                      direction: "ltr"
                    }
                  }
                }}
              >
                {customers.map((c) => (
                  <MenuItem
                    key={c._id || c.id}
                    value={String(c._id || c.id)}
                    sx={{ 
                      direction: "ltr", 
                      justifyContent: "flex-start",
                      textAlign: "left"
                    }}
                  >
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
              dir="ltr"
              sx={{ 
                "& .MuiInputBase-input": {
                  textAlign: "left",
                  direction: "ltr"
                },
                "& .MuiInputLabel-root": {
                  left: 14,
                  right: "auto",
                  transformOrigin: "left"
                }
              }}
            />

            <TextField
              label="מספר אישי"
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              required
              fullWidth
              dir="ltr"
              sx={{ 
                "& .MuiInputBase-input": {
                  textAlign: "left",
                  direction: "ltr"
                },
                "& .MuiInputLabel-root": {
                  left: 14,
                  right: "auto",
                  transformOrigin: "left"
                }
              }}
            />

            {items.map((item, idx) => (
              <Stack
                key={idx}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ direction: "ltr" }}
              >
                <FormControl sx={{ flex: 1 }} required dir="ltr">
                  <InputLabel
                    id={`product-select-label-${idx}`}
                    sx={{ 
                      left: 14,
                      right: "auto",
                      transformOrigin: "left"
                    }}
                  >
                    בחר מוצר
                  </InputLabel>
                  <Select
                    labelId={`product-select-label-${idx}`}
                    id={`product-select-${idx}`}
                    name={`product-${idx}`}
                    value={item.product ? String(item.product) : ""}
                    label="בחר מוצר"
                    onChange={(e) =>
                      handleItemChange(idx, "product", e.target.value)
                    }
                    sx={{ 
                      "& .MuiSelect-select": {
                        textAlign: "left",
                        direction: "ltr"
                      }
                    }}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      PaperProps: {
                        sx: {
                          direction: "ltr"
                        }
                      }
                    }}
                  >
                    {sortedProducts.map((p) => (
                      <MenuItem
                        key={p._id || p.id}
                        value={String(p._id || p.id)}
                        sx={{ 
                          direction: "ltr", 
                          justifyContent: "flex-start",
                          textAlign: "left"
                        }}
                      >
                        {p.sku ? `[${p.sku}] ` : ""}{p.name} (במלאי: {p.stock})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="כמות"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={item.quantity}
                  onChange={(e) =>
                    handleItemChange(idx, "quantity", e.target.value)
                  }
                  required
                  dir="ltr"
                  sx={{ 
                    width: 120,
                    "& .MuiInputBase-input": {
                      textAlign: "center"
                    },
                    "& .MuiInputLabel-root": {
                      left: 14,
                      right: "auto",
                      transformOrigin: "left"
                    }
                  }}
                />

                {items.length > 1 && (
                  <IconButton 
                    color="error" 
                    onClick={() => handleRemoveItem(idx)}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
            ))}

            <Button 
              variant="contained" 
              onClick={handleAddItem} 
              sx={{ 
                mt: 1,
                fontWeight: "bold"
              }}
            >
              הוסף מוצר נוסף
            </Button>

            <Box sx={{ direction: "ltr", textAlign: "left" }}>
              <Typography mb={1} fontWeight="bold">
                חתימה דיגיטלית (חובה):
              </Typography>
              <SimpleSignaturePad onEnd={setSignature} />
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="success"
              fullWidth
              size="large"
              sx={{ 
                fontWeight: "bold",
                fontSize: "1.2rem",
                py: 1.5
              }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "נפק"
              )}
            </Button>

            {error && (
              <Alert severity="error" dir="ltr" sx={{ textAlign: "left" }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" dir="ltr" sx={{ textAlign: "left" }}>
                {success}
              </Alert>
            )}
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
