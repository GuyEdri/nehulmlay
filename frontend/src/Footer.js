// frontend/src/components/Footer.js
import React from "react";

const footerStyles = {
  wrapper: {
    direction: "rtl",
    textAlign: "center",
    borderTop: "1px solid #e5e7eb",
    padding: "14px 10px",
    color: "#4b5563",
    background: "#fafafa",
    fontSize: 14,
  },
  inner: {
    maxWidth: 1200,
    margin: "0 auto",
  },
};

export default function Footer() {
  return (
    <footer style={footerStyles.wrapper}>
      <div style={footerStyles.inner}>
        האפליקציה פותחה ע״י גיא אדרי — 2025
      </div>
    </footer>
  );
}
