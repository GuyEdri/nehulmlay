// frontend/src/App.js
import React, { useState } from "react";
import ProductsList from "./components/ProductsList";
import AddProduct from "./components/AddProduct";
import IssueStock from "./components/IssueStock";
import DeliveriesList from "./components/DeliveriesList";
import Warehouses from "./components/Warehouses";
import AddReturn from "./components/AddReturn";
import ReturnsList from "./components/ReturnsList";
import Footer from "./components/Footer"; // 👈 פוטר קבוע

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import Login from "./components/Login";
import { Button, Stack, Typography, Box, Container } from "@mui/material";

function AppContent() {
  const [screen, setScreen] = useState("products");
  const { user, initializing, logout } = useAuth();

  // מצב תפריט מובייל (מודאל)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV = [
    { key: "products", label: "רשימת מוצרים" },
    { key: "addProduct", label: "הוספת מוצר" },
    { key: "issue", label: "ניפוק מלאי" },
    { key: "return", label: "זיכוי מלאי" },
    { key: "deliveries", label: "רשימת ניפוקים" },
    { key: "returns", label: "רשימת זיכויים" },
    { key: "warehouses", label: "מחסנים" },
  ];

  const navigate = (key) => {
    setScreen(key);
    setMobileMenuOpen(false);
  };

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

  const menuButtonStyle = {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#1976d2",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };

  const menuItemStyle = (key) => ({
    width: "100%",
    textAlign: "right",
    direction: "rtl",
    padding: "12px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: screen === key ? "#e3f2fd" : "#fff",
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} dir="rtl">
      {/* CSS רספונסיבי למובייל */}
      <style>{`
        /* ברירת מחדל: תצוגת דסקטופ */
        .nav-inline { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .mobile-menu { display: none; }

        /* מובייל: מחביאים את שורת הניווט ומציגים כפתור תפריט */
        @media (max-width: 640px) {
          .nav-inline { display: none; }
          .mobile-menu { display: flex; justify-content: center; margin-bottom: 16px; }
        }

        /* רקע למודל התפריט במובייל */
        .menu-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
        }
        .menu-panel {
          width: min(92vw, 420px);
          background: #fff; border-radius: 14px; border: 1px solid #e5e7eb;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          padding: 14px; direction: rtl; text-align: right;
        }
        .menu-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 4px 12px; border-bottom: 1px solid #f1f5f9; margin-bottom: 10px;
        }
        .menu-title { font-size: 18px; font-weight: 800; margin: 0; }
        .menu-close {
          appearance: none; border: none; background: #f3f4f6; color: #111827;
          padding: 8px 12px; border-radius: 10px; font-weight: 700; cursor: pointer;
        }
        .menu-grid {
          display: grid; grid-template-columns: 1fr; gap: 10px;
        }
      `}</style>

      {/* פס עליון */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            מחובר כ־ {user.email || user.uid}
          </Typography>
          <Button variant="outlined" size="small" onClick={logout}>
            יציאה
          </Button>
        </Stack>
      </Stack>

      {/* תפריט מובייל: כפתור תפריט */}
      <div className="mobile-menu">
        <button style={menuButtonStyle} onClick={() => setMobileMenuOpen(true)}>
          תפריט
        </button>
      </div>

      {/* תפריט דסקטופ: שורת כפתורים רגילה */}
      <nav className="nav-inline" aria-label="ניווט ראשי">
        {NAV.map(({ key, label }) => (
          <button key={key} onClick={() => navigate(key)} style={navBtnStyle(key)}>
            {label}
          </button>
        ))}
      </nav>

      {/* מודאל תפריט למובייל */}
      {mobileMenuOpen && (
        <div className="menu-backdrop" onClick={() => setMobileMenuOpen(false)} role="dialog" aria-modal="true">
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h3 className="menu-title">בחר מסך</h3>
              <button className="menu-close" onClick={() => setMobileMenuOpen(false)}>סגור</button>
            </div>
            <div className="menu-grid">
              {NAV.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  style={menuItemStyle(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
      {/* מעטפת כללית כדי שהפוטר ידבק לתחתית גם בעמודים קצרים */}
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#f8fafc",
        }}
        dir="rtl"
      >
        {/* גוף האפליקציה */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <AppContent />
        </div>

        {/* פוטר קבוע לכל העמודים */}
        <Footer />
      </div>
    </AuthProvider>
  );
}
