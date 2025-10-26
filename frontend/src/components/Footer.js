// frontend/src/components/Footer.js
import React from "react";

const footerStyles = {
  wrapper: {
    direction: "rtl",
    textAlign: "center",
    borderTop: "1px solid rgba(0,0,0,0.05)",
    padding: "18px 10px",
    color: "#1e293b",
    background: "linear-gradient(90deg, #f8fafc 0%, #e0f2fe 100%)",
    fontSize: 15,
    fontWeight: 500,
    letterSpacing: "0.3px",
    boxShadow: "0 -2px 4px rgba(0,0,0,0.04)",
    transition: "background 0.3s ease",
  },
  inner: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  heart: {
    color: "#ef4444",
    margin: "0 4px",
  },
  hover: {
    background: "linear-gradient(90deg, #e0f2fe 0%, #bae6fd 100%)",
  },
};

export default function Footer() {
  const [hover, setHover] = React.useState(false);

  return (
    <footer
      style={{
        ...footerStyles.wrapper,
        ...(hover ? footerStyles.hover : {}),
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={footerStyles.inner}>
        האפליקציה פותחה ע"י <strong>גיא אדרי</strong> 2025
      </div>
    </footer>
  );
}
