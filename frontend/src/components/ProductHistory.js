// frontend/src/components/ProductHistory.js
import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Box, Typography, List, ListItem, Divider } from "@mui/material";

export default function ProductHistory({ productId }) {
  const [history, setHistory] = useState([]);
  const [productName, setProductName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const asId = (v) => (v == null ? "" : String(v));

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!productId) {
        if (!mounted) return;
        setHistory([]);
        setProductName("");
        setError("");
        return;
      }

      setLoading(true);
      setError("");

      const pid = asId(productId);

      // 1) נסה לשלוף שם מוצר ישירות לפי מזהה; אם אין ראוט כזה — נפל לרשימה מלאה
      try {
        let name = "";
        try {
          const one = await api.get(`/api/products/${pid}`);
          name = one?.data?.name;
        } catch {
          const all = await api.get("/api/products");
          const p = (all.data || []).find((x) => asId(x._id || x.id) === pid);
          name = p?.name || pid;
        }
        if (mounted) setProductName(name || pid);
      } catch {
        if (mounted) setProductName(pid);
      }

      // 2) שלוף ניפוקים המכילים את המוצר
      try {
        const res = await api.get("/api/deliveries", { params: { product: pid } });
        const list = Array.isArray(res.data) ? res.data : [];

        // ודא שמופיעים רק ניפוקים שבאמת מכילים את המוצר
        const filtered = list.filter(
          (d) =>
            Array.isArray(d.items) &&
            d.items.some((i) => asId(i.product) === pid)
        );

        // מיין לפי תאריך יורד (חדש לישן), אם קיים תאריך
        filtered.sort((a, b) => {
          const da = toDate(a?.date)?.getTime() ?? 0;
          const db = toDate(b?.date)?.getTime() ?? 0;
          return db - da;
        });

        if (mounted) setHistory(filtered);
      } catch (e) {
        if (mounted) {
          setHistory([]);
          setError(e?.response?.data?.error || "שגיאה בטעינת היסטוריית ניפוקים");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [productId]);

  const toDate = (date) => {
    try {
      if (!date) return null;
      // תמיכה ב-Firestore Timestamp (seconds/nanoseconds או _seconds/_nanoseconds)
      if (typeof date === "object") {
        const sec = date.seconds ?? date._seconds;
        const nsec = date.nanoseconds ?? date._nanoseconds ?? 0;
        if (typeof sec === "number") {
          return new Date(sec * 1000 + Math.floor(nsec / 1e6));
        }
      }
      // מחרוזת/מספר
      const d = new Date(date);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const formatDate = (date) => {
    const d = toDate(date);
    return d ? d.toLocaleString("he-IL") : "";
    // אם תרצה פורמט מדויק יותר:
    // return d ? d.toLocaleString("he-IL", { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : "";
  };

  if (!productId) {
    return <Typography>בחר מוצר כדי לראות היסטוריית ניפוקים.</Typography>;
  }

  if (loading) {
    return <Typography>טוען היסטוריה...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (!history.length) {
    return <Typography>אין היסטוריית ניפוקים עבור מוצר זה.</Typography>;
  }

  return (
    <Box sx={{ direction: "rtl", textAlign: "right", maxWidth: 600, margin: "auto" }}>
      <Typography variant="h6" mb={2} color="primary">
        היסטוריית ניפוקים למוצר: {productName}
      </Typography>
      <List>
        {history.map((d, idx) => {
          const relevantItems = (d.items || []).filter(
            (i) => asId(i.product) === asId(productId)
          );
          return relevantItems.map((item, itemIdx) => {
            const key = asId(d._id || d.id) || `${idx}-${itemIdx}`;
            return (
              <React.Fragment key={key}>
                <ListItem sx={{ display: "block" }}>
                  <Typography>
                    <b>{formatDate(d.date)}</b> | לקוח:{" "}
                    {d.customerName || d.customer?.name || "לא ידוע"} | כמות: {item.quantity}
                  </Typography>
                </ListItem>
                {(idx < history.length - 1 || itemIdx < relevantItems.length - 1) && <Divider />}
              </React.Fragment>
            );
          });
        })}
      </List>
    </Box>
  );
}

