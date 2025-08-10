// frontend/src/auth/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();

  if (initializing) return null; // אפשר להציג ספינר

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

