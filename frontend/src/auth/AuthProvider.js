// frontend/src/auth/AuthProvider.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebaseClient";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { api } from "../api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // שמירת משתמש מחובר
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  // הוספת ID Token לכל בקשת API (Axios interceptor)
  useEffect(() => {
    const id = api.interceptors.request.use(async (config) => {
      const u = auth.currentUser;
      if (u) {
        const token = await u.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }
      return config;
    });
    return () => api.interceptors.request.eject(id);
  }, []);

  const login = async (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  return (
    <AuthCtx.Provider value={{ user, initializing, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

