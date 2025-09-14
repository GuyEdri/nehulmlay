// frontend/src/components/Warehouses.js
import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  Box, Paper, TextField, Button, Typography, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert
} from "@mui/material";

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
    } catch (e) {
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
    <Box sx={{ direction: "rtl", textAlign: "right", p: 3, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        מחסנים
      </Typography>

      {/* טופס יצירת מחסן */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" mb={1}>יצירת מחסן חדש</Typography>
        <form onSubmit={onCreate}>
          <Stack spacing={2}>
            <TextField
              label="שם מחסן *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              inputProps={{ style: { textAlign: "right" } }}
            />
            <TextField
              label="כתובת (רשות)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              inputProps={{ style: { textAlign: "right" } }}
            />
            <TextField
              label="הערות (רשות)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              inputProps={{ style: { textAlign: "right" } }}
            />
            <Button type="submit" variant="contained">צור מחסן</Button>
            {err && <Alert severity="error" dir="rtl">{err}</Alert>}
            {success && <Alert severity="success" dir="rtl">{success}</Alert>}
          </Stack>
        </form>
      </Paper>

      {/* רשימת מחסנים */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="right" sx={{ width: "35%" }}>שם</TableCell>
              <TableCell align="right" sx={{ width: "35%" }}>כתובת</TableCell>
              <TableCell align="right" sx={{ width: "30%" }}>הערות</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={3} align="center">טוען…</TableCell></TableRow>
            )}
            {!loading && list.length === 0 && (
              <TableRow><TableCell colSpan={3} align="center" sx={{ color: "text.secondary" }}>
                אין מחסנים עדיין
              </TableCell></TableRow>
            )}
            {list.map((w) => {
              const id = String(w._id || w.id);
              return (
                <TableRow key={id} hover>
                  <TableCell align="right">{w.name || "(ללא שם)"}</TableCell>
                  <TableCell align="right">{w.address || "—"}</TableCell>
                  <TableCell align="right">{w.notes || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

