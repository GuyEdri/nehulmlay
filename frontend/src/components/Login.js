// frontend/src/components/Login.js
import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Box, Paper, TextField, Button, Typography, Stack, Alert } from "@mui/material";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      setLoading(true);
      await login(email.trim(), password);
      // הניווט יקרה אוטומטית כי ה־App יראה שהמשתמש קיים
    } catch (e2) {
      setErr(e2?.message || "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: "grid", placeItems: "center", minHeight: "80vh", direction: "rtl" }}>
      <Paper elevation={3} sx={{ p: 3, width: "100%", maxWidth: 380 }}>
        <Typography variant="h5" textAlign="center" mb={2}>התחברות</Typography>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="אימייל"
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
              inputProps={{ dir: "ltr" }}
            />
            <TextField
              label="סיסמה"
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
              inputProps={{ dir: "ltr" }}
            />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "מתחבר..." : "התחבר"}
            </Button>
            {err && <Alert severity="error" dir="rtl">{err}</Alert>}
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}

