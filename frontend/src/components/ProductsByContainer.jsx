// frontend/src/components/ProductsByContainer.jsx (מעודכן לשימוש ב-api עם Authorization)
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

// אפשר להחליף ל-MUI/Antd אם אתה כבר משתמש.
// כאן נלך על HTML פשוט ונקי.

export default function ProductsByContainer() {
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/products", { params: { groupBy: "container" } });
        if (!isMounted) return;
        setGroups(res.data?.groups || {});
      } catch (e) {
        if (!isMounted) return;
        setGroups({});
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const needle = q.trim().toLowerCase();
    const result = {};
    Object.entries(groups).forEach(([container, items]) => {
      const filtered = items.filter(it => {
        const hay = [
          it.name, it.sku, it.description, it.container
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
      });
      if (filtered.length) result[container] = filtered;
    });
    return result;
  }, [groups, q]);

  const sortedContainers = useMemo(() => {
    return Object.keys(filteredGroups).sort((a, b) =>
      String(a).localeCompare(String(b), "he")
    );
  }, [filteredGroups]);

  if (loading) return <div>טוען מוצרים לפי מכולות…</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>מוצרים לפי מכולה</h2>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="חיפוש לפי שם/תיאור/מק״ט/מכולה…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            padding: "8px 12px",
            width: "100%",
            maxWidth: 420,
            borderRadius: 8,
            border: "1px solid #ccc"
          }}
        />
      </div>

      {sortedContainers.length === 0 ? (
        <div>לא נמצאו תוצאות.</div>
      ) : (
        <div className="accordion-list">
          {sortedContainers.map((containerKey) => (
            <Accordion key={containerKey} title={`מכולה: ${containerKey}`}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>שם</th>
                    <th style={th}>מק״ט</th>
                    <th style={th}>כמות</th>
                    <th style={th}>תיאור</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups[containerKey].map((p) => (
                    <tr key={p.id}>
                      <td style={td}>{p.name || "-"}</td>
                      <td style={td}>{p.sku || "-"}</td>
                      <td style={td}>{p.stock ?? "-"}</td>
                      <td style={td}>{p.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 10, border: "1px solid #e2e2e2", borderRadius: 10 }}>
      <button
        onClick={() => setOpen((x) => !x)}
        style={{
          width: "100%",
          textAlign: "start",
          padding: "12px 14px",
          background: "#fafafa",
          border: "none",
          borderRadius: "10px 10px 0 0",
          cursor: "pointer",
          fontWeight: 600
        }}
      >
        {open ? "▾ " : "▸ "}{title}
      </button>
      {open && <div style={{ padding: 12 }}>{children}</div>}
    </div>
  );
}

const th = { textAlign: "right", borderBottom: "1px solid #eee", padding: "8px" };
const td = { borderBottom: "1px solid #f4f4f4", padding: "8px" };

