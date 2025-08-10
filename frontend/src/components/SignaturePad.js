// frontend/src/components/SignaturePad.js
import React, { useRef, useState, useEffect } from "react";

function SimpleSignaturePad({
  onEnd,
  width = 300,
  height = 120,
  lineWidth = 2,
  color = "#000",
  background = "#fff",
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false); // ref כדי להימנע מרינדורים מיותרים
  const dprRef = useRef(1);

  // הכנה/שינוי גודל ל-DPR גבוה (מסכים רטינה וכו')
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    // קובע גודל לוגי (CSS) וגודל פיזי (בפיקסלים)
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
    ctx.scale(dpr, dpr);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;

    // רקע לבן כדי שמסמך PDF לא יראה שקוף
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }, [width, height, lineWidth, color, background]);

  // ממיר נקודת אירוע (עכבר/מגע) לקואורדינטות בקנבס
  const getPos = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y };
  };

  // בדיקה אם הקנבס ריק (בלי החתימה); מתחשב ברקע שמצויר
  const isCanvasBlank = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // קורא נתונים בגודל לוגי (לא מוכפל DPR בגלל scale)
    const imageData = ctx.getImageData(0, 0, width, height).data;
    // בדיקה מהירה: אם כמעט כל הפיקסלים בצבע רקע, נחשב ריק
    // נבדוק כל N פיקסלים כדי לחסוך זמן
    const step = 10;
    const bg = hexToRgb(background);
    let foundDifferent = false;

    for (let i = 0; i < imageData.length; i += 4 * step) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3]; // 255 אם אטום
      // אם יש חריגה משמעותית מהרקע — יש ציור
      if (!approxEqual(r, bg.r) || !approxEqual(g, bg.g) || !approxEqual(b, bg.b) || a !== 255) {
        foundDifferent = true;
        break;
      }
    }
    return !foundDifferent;
  };

  const approxEqual = (a, b) => Math.abs(a - b) <= 2;

  const hexToRgb = (hex) => {
    // מקבל "#fff" או "#ffffff"
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h.split("").map((c) => c + c).join("");
    }
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  const startDrawing = (x, y) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawLine = (x, y) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    if (onEnd) {
      if (isCanvasBlank()) {
        onEnd(null);
      } else {
        // מייצא כתמונה PNG ב-Base64 (dataURL)
        onEnd(canvasRef.current.toDataURL("image/png"));
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // מנקה ומחזיר רקע
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // איפוס כדי לנקות את כל הבְּפיזי
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // לבנות את ה-scale והמאפיינים מחדש
    const dpr = dprRef.current || 1;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (onEnd) onEnd(null);
  };

  // אירועי עכבר
  const handleMouseDown = (e) => {
    e.preventDefault();
    const { offsetX, offsetY } = e.nativeEvent;
    startDrawing(offsetX, offsetY);
  };
  const handleMouseMove = (e) => {
    e.preventDefault();
    const { offsetX, offsetY } = e.nativeEvent;
    drawLine(offsetX, offsetY);
  };
  const handleMouseUp = (e) => {
    e.preventDefault();
    stopDrawing();
  };

  // אירועי מגע
  const handleTouchStart = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const { x, y } = getPos(t.clientX, t.clientY);
    startDrawing(x, y);
  };
  const handleTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const { x, y } = getPos(t.clientX, t.clientY);
    drawLine(x, y);
  };
  const handleTouchEnd = (e) => {
    e.preventDefault();
    stopDrawing();
  };

  return (
    <div style={{ direction: "rtl", textAlign: "right" }}>
      <canvas
        ref={canvasRef}
        // הגודל הוויזואלי נשלט ע"י style (וגם ב-useEffect)
        style={{
          border: "1px solid #000",
          background: background,
          touchAction: "none",
          display: "block",
          maxWidth: "100%",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleClear}>נקה חתימה</button>
      </div>
    </div>
  );
}

export default SimpleSignaturePad;

