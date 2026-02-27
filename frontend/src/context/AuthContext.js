import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("filamentos_token");
    const savedUser = localStorage.getItem("filamentos_user");
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      api.get("/auth/me").then((res) => {
        setUser(res.data);
        localStorage.setItem("filamentos_user", JSON.stringify(res.data));
      }).catch(() => {
        localStorage.removeItem("filamentos_token");
        localStorage.removeItem("filamentos_user");
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("filamentos_token", res.data.token);
    localStorage.setItem("filamentos_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const res = await api.post("/auth/register", { username, email, password });
    localStorage.setItem("filamentos_token", res.data.token);
    localStorage.setItem("filamentos_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("filamentos_token");
    localStorage.removeItem("filamentos_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
