// frontend/src/components/Warehouses.js
import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  Box, Paper, TextField, Button, Typography, Stack, Alert
} from "@mui/material";

// סטייל קבוע לשדות טופס ב-RTL (כולל לייבלים)
const rtlTextFieldSx = {
  direction: "rtl",
  textAlign: "right",
  "& .MuiInputBase-root": {
    direction: "rtl",
    textAlign: "right",
  },
  "& .MuiInputBase-input": {
    direction: "rtl",
    textAlign: "right",
  },
  "& .MuiFormLabel-root": {
    right: 14,
    left: "auto",
    transformOrigin: "right top",
    textAlign: "right",
  },
  // לפעמים האאוטליין וה-legend מתעקשים — מהדקים גם אותם
  "& .MuiOutlinedInput-notchedOutline legend": {
    textAlign: "right",
  },
};

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // שדות לטופס יצירת מחסן
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
    e?.preventDefault();
    setErr("");
    setSuccess("");

    const cleanName = (name || "").trim();
    if (!cleanName) {
      setErr("יש להזין שם מחסן");
      return;
    }

    try {
      await api.post("/api/warehouses", {
        name: cleanName,
        address: (address || "").trim(),
        notes: (notes || "").trim(),
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
    <Box
      dir="rtl"
      sx={{
        direction: "rtl",
        textAlign: "right",
        p: 3,
        maxWidth: 900,
        mx: "auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <Typography variant="h5" fontWeight="bold" mb={2}>
        מחסנים
      </Typography>

      {/* טופס יצירת מחסן */} 
      <Paper sx={{ p: 2, mb: 3 }}> <Typography variant="h6" mb={1}>יצירת מחסן חדש</Typography> <form onSubmit={onCreate}> <Stack spacing={2}> <TextField label="שם מחסן *" value={name} onChange={(e) => setName(e.target.value)} required inputProps={{ style: { textAlign: "right" } }} /> <TextField label="כתובת (רשות)" value={address} onChange={(e) => setAddress(e.target.value)} inputProps={{ style: { textAlign: "right" } }} /> <TextField label="הערות (רשות)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} inputProps={{ style: { textAlign: "right" } }} /> <Button type="submit" variant="contained">צור מחסן</Button> {err && <Alert severity="error" dir="rtl">{err}</Alert>} {success && <Alert severity="success" dir="rtl">{success}</Alert>} </Stack> </form> </Paper>
      {/* רשימת מחסנים – טבלת HTML רגילה */}
      <Paper sx={{ p: 0 }} dir="rtl">
        <div style={{ padding: "12px 16px" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>רשימת מחסנים</Typography>
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
  );
}

// סטיילים לטבלת ה-HTML (ימין לשמאל ויישור לימין)
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

