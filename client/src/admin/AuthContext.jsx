import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { adminGet, adminPost, TOKEN_KEY } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (email, password) => {
    const res = await adminPost("/auth/login", { email, password });
    if (res?.data?.accessToken) localStorage.setItem(TOKEN_KEY, res.data.accessToken);
    setAdmin(res.data.admin);
    return res.data.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminPost("/auth/logout");
    } catch (_) {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    setAdmin(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    adminGet("/auth/me")
      .then((res) => setAdmin(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ admin, loading, login, logout, setAdmin }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}