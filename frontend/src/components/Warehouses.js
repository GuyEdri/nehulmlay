// frontend/src/components/Warehouses.js
import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { prefixer } from "stylis";

// יצירת theme RTL אמיתי עם MUI
const theme = createTheme({
  direction: "rtl",
  typography: { fontFamily: "Arial, sans-serif" },
});

// Cache עבור RTL
const cacheRtl = createCache({
  key: "mui-rtl",
  stylisPlugins: [prefixer, rtlPlugin],
});

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/warehouses");
      setList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setErr("");
    setSuccess("");

    if (!name.trim()) {
      setErr("יש להזין שם מחסן");
      return;
    }

    try {
      await api.post("/api/warehouses", {
        name: name.trim(),
        address: address.trim(),
        notes: notes.trim(),
      });
      setSuccess("המחסן נוצר בהצלחה");
      setName("");
      setAddress("");
      setNotes("");
      fetchWarehouses();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "שגיאה ביצירת מחסן");
    }
  };

  return (
    <CacheProvider value={cacheRtl}>
      <ThemeProvider theme={theme}>
        <Box
          dir="rtl"
          sx={{
            direction: "rtl",
            textAlign: "right",
            p: 3,
            maxWidth: 900,
            mx: "auto",
          }}
        >
          <Typography variant="h5" fontWeight="bold" mb={2} textAlign="center">
            מחסנים
          </Typography>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" mb={2} textAlign="center">
              יצירת מחסן חדש
            </Typography>

            <form onSubmit={onCreate} dir="rtl" style={{ direction: "rtl", textAlign: "right" }}>
  <Stack spacing={2} sx={{ direction: "rtl", textAlign: "right" }}>
    <TextField
      label="שם מחסן *"
      value={name}
      onChange={(e) => setName(e.target.value)}
      required
      fullWidth
      sx={rtlTextFieldSx}                   // ← רק זה!
      inputProps={{ dir: "rtl" }}
      InputLabelProps={{
        sx: { right: 14, left: "auto", transformOrigin: "right top", textAlign: "right" },
      }}
    />

    <TextField
      label="כתובת (רשות)"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      fullWidth
      sx={rtlTextFieldSx}                   // ← רק זה!
      inputProps={{ dir: "rtl" }}
      InputLabelProps={{
        sx: { right: 14, left: "auto", transformOrigin: "right top", textAlign: "right" },
      }}
    />

    <TextField
      label="הערות (רשות)"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      fullWidth
      multiline
      minRows={2}
      sx={rtlTextFieldSx}                   // ← רק זה!
      inputProps={{ dir: "rtl" }}
      InputLabelProps={{
        sx: { right: 14, left: "auto", transformOrigin: "right top", textAlign: "right" },
      }}
    />

    <Stack direction="row" justifyContent="flex-end">
      <Button type="submit" variant="contained">צור מחסן</Button>
    </Stack>

    {err && <Alert severity="error" dir="rtl">{err}</Alert>}
    {success && <Alert severity="success" dir="rtl">{success}</Alert>}
  </Stack>
</form>

          </Paper>

          {/* רשימת מחסנים – טבלת HTML רגילה */}
          <Paper sx={{ p: 0 }}>
            <div style={{ padding: "12px 16px" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                רשימת מחסנים
              </Typography>
            </div>

            {loading ? (
              <div style={{ padding: "24px", textAlign: "center" }}>טוען…</div>
            ) : list.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#777" }}>
                אין מחסנים עדיין
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  dir="rtl"
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                    direction: "rtl",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th style={thStyle}>שם</th>
                      <th style={thStyle}>כתובת</th>
                      <th style={thStyle}>הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((w) => {
                      const id = String(w._id || w.id);
                      return (
                        <tr key={id} style={{ borderTop: "1px solid #eee" }}>
                          <td style={tdStyle}>{w.name || "(ללא שם)"}</td>
                          <td style={tdStyle}>{w.address || "—"}</td>
                          <td style={tdStyle}>{w.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Paper>
        </Box>
      </ThemeProvider>
    </CacheProvider>
  );
}

// סטיילים לטבלה
const thStyle = {
  textAlign: "right",
  padding: "12px 16px",
  borderBottom: "1px solid #e0e0e0",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle = {
  textAlign: "right",
  padding: "12px 16px",
  verticalAlign: "top",
  wordBreak: "break-word",
};
