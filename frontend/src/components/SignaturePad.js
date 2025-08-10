// frontend/src/components/SignaturePad.js
import React, { useRef, useEffect } from "react";

function SimpleSignaturePad({
  onEnd,
  width = 300,
  height = 120,
  lineWidth = 2,
  color = "#000",
  background = "#fff",
  clearLabel = "נקה חתימה",
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dprRef = useRef(1);

  // הכנה/אתחול קנבס עם תמיכה ב-DPR
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    // גודל CSS
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // גודל פיזי (פיקסלים)
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));

    // איפוס וסקייל
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // מאפייני קו
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;

    // רקע אטום
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  useEffect(() => {
    initCanvas();
    // רענון כשפרופס משתנים
  }, [width, height, lineWidth, color, background]);

  // עזר – המרה לקואורדינטות לוגיות (בלי DPR)
  const clientToCanvas = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // בדיקה אם הקנבס ריק – קורא את כל הבופר בפיקסלים (canvas.width/height)
  const isCanvasBlank = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width: W, height: H } = canvas; // פיקסלים פיזיים

    const imageData = ctx.getImageData(0, 0, W, H).data;
    // ממירים צבע רקע ל-RGB להשוואה
    const bg = hexToRgb(background);
    const step = 16; // דילוג כדי להיות יעילים

    const isDifferent = (r, g, b, a) => {
      // הפיקסל שונה מהרקע (מרווח טולרנס קטן)
      return (
        Math.abs(r - bg.r) > 2 ||
        Math.abs(g - bg.g) > 2 ||
        Math.abs(b - bg.b) > 2 ||
        a !== 255
      );
    };

    for (let i = 0; i < imageData.length; i += 4 * step) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];
      if (isDifferent(r, g, b, a)) return false; // יש ציור
    }
    return true; // הכול רקע
  };

  const hexToRgb = (hex) => {
    let h = String(hex || "#fff").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };

  // ציור
  const start = (x, y) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (x, y) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (onEnd) {
      if (isCanvasBlank()) onEnd(null);
      else onEnd(canvasRef.current.toDataURL("image/png"));
    }
  };

  // ניקוי
  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // נקה פיזית
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // שחזר scale/מאפיינים
    const dpr = dprRef.current || 1;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;

    // רקע אטום מחדש
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (onEnd) onEnd(null);
  };

  // Pointer Events – תומך במגע/עכבר/עט
  const onPointerDown = (e) => {
    e.preventDefault();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    start(x, y);
  };
  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    move(x, y);
  };
  const onPointerUp = (e) => {
    e.preventDefault();
    end();
  };
  const onPointerLeave = (e) => {
    e.preventDefault();
    end();
  };

  return (
    <div style={{ direction: "rtl", textAlign: "right" }}>
      <canvas
        ref={canvasRef}
        // הגודל הוויזואלי נשלט ע"י style; הגודל הפיזי נקבע ב-initCanvas
        style={{
          border: "1px solid #000",
          background,
          touchAction: "none",
          display: "block",
          maxWidth: "100%",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={handleClear}>
          {clearLabel}
        </button>
      </div>
    </div>
  );
}

export default SimpleSignaturePad;

