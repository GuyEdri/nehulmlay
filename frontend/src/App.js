// frontend/src/App.js
import React, { useState } from "react";
import ProductsList from "./components/ProductsList";
import AddProduct from "./components/AddProduct";
import IssueStock from "./components/IssueStock";
import DeliveriesList from "./components/DeliveriesList";
import Warehouses from "./components/Warehouses";
import AddReturn from "./components/AddReturn";
import ReturnsList from "./components/ReturnsList";

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import Login from "./components/Login";
import { Button, Stack, Typography, Box, Container } from "@mui/material";

function AppContent() {
  const [screen, setScreen] = useState("products");
  const { user, initializing, logout } = useAuth();

  if (initializing) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>טוען...</Typography>
      </Box>
    );
  }

  if (!user) {
    return <Login />;
  }

  const navBtnStyle = (key) => ({
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #ddd",
    background: screen === key ? "#1976d2" : "#f5f5f5",
    color: screen === key ? "#fff" : "#333",
    cursor: "pointer",
    fontWeight: 600,
  });

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* פס עליון */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          ניהול מלאי
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            מחובר כ־ {user.email || user.uid}
          </Typography>
          <Button variant="outlined" size="small" onClick={logout}>
            יציאה
          </Button>
        </Stack>
      </Stack>

      {/* תפריט ניווט */}
      <nav
        style={{
          marginBottom: 24,
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setScreen("products")} style={navBtnStyle("products")}>
          רשימת מוצרים
        </button>
        <button onClick={() => setScreen("addProduct")} style={navBtnStyle("addProduct")}>
          הוספת מוצר
        </button>
        <button onClick={() => setScreen("issue")} style={navBtnStyle("issue")}>
          ניפוק מלאי
        </button>
        <button onClick={() => setScreen("return")} style={navBtnStyle("return")}>
          זיכוי מלאי
        </button>
        <button onClick={() => setScreen("deliveries")} style={navBtnStyle("deliveries")}>
          רשימת ניפוקים
        </button>
        <button onClick={() => setScreen("returns")} style={navBtnStyle("returns")}>
          רשימת זיכויים
        </button>
        <button onClick={() => setScreen("warehouses")} style={navBtnStyle("warehouses")}>
          מחסנים
        </button>
      </nav>

      {/* המסכים */}
      {screen === "products" && <ProductsList />}
      {screen === "addProduct" && <AddProduct onAdd={() => setScreen("products")} />}
      {screen === "issue" && <IssueStock onIssued={() => setScreen("products")} />}
      {screen === "return" && <AddReturn onCreated={() => setScreen("products")} />}
      {screen === "deliveries" && <DeliveriesList />}
      {screen === "returns" && <ReturnsList />}
      {screen === "warehouses" && <Warehouses />}
    </Container>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

