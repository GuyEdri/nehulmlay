// frontend/src/App.js
import React, { useState } from "react";
import ProductsList from "./components/ProductsList";
import AddProduct from "./components/AddProduct";
import IssueStock from "./components/IssueStock";
import DeliveriesList from "./components/DeliveriesList";
import ProductsByContainer from "./components/ProductsByContainer.jsx";
import Warehouses from "./components/Warehouses"; // 👈 חדש
import AddReturn from "./components/AddReturn";    // 👈 חדש: טופס זיכוי
import ReturnsList from "./components/ReturnsList";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import Login from "./components/Login";
import { Button, Stack, Typography, Box } from "@mui/material";

function AppContent() {
  const [screen, setScreen] = useState("products");
  const { user, initializing, logout } = useAuth();

  if (initializing) {
    return (
      <Box sx={{ p: 4, direction: "rtl", textAlign: "center" }}>
        <Typography>טוען...</Typography>
      </Box>
    );
  }

  // לא מחובר → מסך התחברות
  if (!user) {
    return <Login />;
  }

  // מחובר → האפליקציה
  return (
    <div style={{ direction: "rtl", padding: 24, fontFamily: "Arial, sans-serif" }}>
      {/* פס עליון: פרטי משתמש + יציאה */}
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
          <Typography variant="body2" sx={{ color: "#555" }}>
            מחובר כ־ {user.email || user.uid}
          </Typography>
          <Button variant="outlined" size="small" onClick={logout}>
            יציאה
          </Button>
        </Stack>
      </Stack>

      {/* תפריט ניווט עליון */}
      <nav
        style={{
          marginBottom: 24,
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setScreen("products")} style={{ padding: "8px 16px" }}>
          רשימת מוצרים
        </button>
        <button onClick={() => setScreen("addProduct")} style={{ padding: "8px 16px" }}>
          הוספת מוצר
        </button>
        <button onClick={() => setScreen("issue")} style={{ padding: "8px 16px" }}>
          ניפוק מלאי
        </button>
        <button onClick={() => setScreen("return")} style={{ padding: "8px 16px" }}>
          זיכוי מלאי {/* 👈 חדש */}
        </button>
        <button onClick={() => setScreen("deliveries")} style={{ padding: "8px 16px" }}>
	<button onClick={() => setScreen("returns")} style={{ padding: "8px 16px" }}>
	  רשימת זיכויים
	</button>
          רשימת ניפוקים
        </button>
        <button onClick={() => setScreen("warehouses")} style={{ padding: "8px 16px" }}>
          מחסנים
        </button>
      </nav>

      {/* המסכים */}
      {screen === "products" && <ProductsList />}
      {screen === "addProduct" && <AddProduct onAdd={() => setScreen("products")} />}
      {screen === "issue" && <IssueStock onIssued={() => setScreen("products")} />}
      {screen === "return" && <AddReturn onCreated={() => setScreen("products")} />}{/* 👈 חדש */}
      {screen === "deliveries" && <DeliveriesList />}
      {screen === "returns" && <ReturnsList />}
      {screen === "warehouses" && <Warehouses />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

