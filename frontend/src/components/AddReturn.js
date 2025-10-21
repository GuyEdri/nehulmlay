// frontend/src/components/AddReturn.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

export default function AddReturn({ onCreated }) {
  // ... כל הסטייטים הקיימים שלך ללא שינוי ...

  // 👇 חתימה
  const [signature, setSignature] = useState("");
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  // ציור חופשי על הקנבס (עובד גם בעכבר וגם בטאצ')
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const x = (touch?.clientX ?? e.clientX) - rect.left;
    const y = (touch?.clientY ?? e.clientY) - rect.top;
    return { x, y };
  };
  const startDraw = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => {
    drawing.current = false;
    // עדכון dataURL
    if (canvasRef.current) {
      setSignature(canvasRef.current.toDataURL("image/png"));
    }
  };
  const clearSignature = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    setSignature("");
  };

  // ... useEffect לטעינת מחסנים/לקוחות וכו' (ללא שינוי) ...

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // ... ולידציות קיימות ...

    try {
      setLoading(true);
      const body = {
        warehouseId: String(warehouseId || "").trim(),
        customer: String(customerId),
        customerName: String(customerName).trim(),
        returnedBy: String(returnedBy).trim(),
        items,
        date: date ? new Date(date).toISOString() : undefined,
        personalNumber: personalNumber ? String(personalNumber) : "",
        notes: String(notes || ""),

        // 👇 שולחים חתימה אם קיימת
        ...(signature ? { signature } : {}),
      };

      const res = await api.post("/api/returns", body);
      setSuccessMsg("הזיכוי נשמר בהצלחה ✅");

      // איפוס טופס (כולל חתימה)
      // ... כל האיפוסים שלך ...
      clearSignature();

      if (onCreated) onCreated(res.data);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || "שגיאה בשמירת הזיכוי");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "auto", direction: "rtl" }}>
      {/* ... כל הטופס הקיים ... */}

      {/* ===== חתימה ===== */}
      <h3 style={{ marginTop: 16, marginBottom: 8 }}>חתימה</h3>
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8, marginBottom: 12 }}>
        <canvas
          ref={canvasRef}
          width={680}
          height={160}
          style={{ width: "100%", background: "#fff", cursor: "crosshair", touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={clearSignature} style={{ padding: "6px 12px" }}>
            נקה חתימה
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4, textAlign: "right" }}>
          חתום/י בעכבר או באצבע (נייד).
        </div>
      </div>

      {/* ... כפתור שמירה + הודעות ... */}
    </form>
  );
}

// ... searchTimers וכו' (ללא שינוי) ...

