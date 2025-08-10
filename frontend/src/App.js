import React, { useState } from "react";
import ProductsList from "./components/ProductsList";
import AddProduct from "./components/AddProduct";
import IssueStock from "./components/IssueStock";
import DeliveriesList from "./components/DeliveriesList";

export default function App() {
  const [screen, setScreen] = useState("products");

  return (
    <div style={{ direction: "rtl", padding: 24, fontFamily: 'Arial, sans-serif' }}>
      {/* תפריט ניווט עליון */}
      <nav style={{ marginBottom: 24, display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={() => setScreen("products")} style={{ padding: "8px 16px" }}>
          רשימת מוצרים
        </button>
        <button onClick={() => setScreen("addProduct")} style={{ padding: "8px 16px" }}>
          הוספת מוצר
        </button>
        <button onClick={() => setScreen("issue")} style={{ padding: "8px 16px" }}>
          ניפוק מלאי
        </button>
	<button onClick={() => setScreen("deliveries")} style={{ padding: "8px 16px" }}>
  רשימת ניפוקים
</button>
      </nav>

      {/* הצגת המסך בהתאם לבחירה */}
      {screen === "products" && <ProductsList />}
      {screen === "addProduct" && <AddProduct onAdd={() => setScreen("products")} />}
      {screen === "issue" && <IssueStock onIssued={() => setScreen("products")} />}
      {screen === "deliveries" && <DeliveriesList />}
    </div>
  );
}

