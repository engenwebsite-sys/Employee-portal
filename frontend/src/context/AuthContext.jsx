import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { tokenStore } from "../lib/tokenStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only "loading" if a saved session has to be checked with the server.
  const [loading, setLoading] = useState(() => tokenStore.hasSession());

  // Restore the session after a page refresh.
  useEffect(() => {
    if (!tokenStore.hasSession()) return;
    let active = true;
    api("/me")
      .then((me) => active && setUser(me))
      .catch((err) => {
        // Only a rejected session signs you out; a server that is briefly down does not.
        if (err.status === 401) tokenStore.clear();
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // api.js fires this when a refresh fails (expired or revoked session).
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", auth: false, body: { email, password } });
    tokenStore.set(data);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithMicrosoft = useCallback(async (code, state) => {
    const data = await api("/auth/microsoft/callback", {
      method: "POST",
      auth: false,
      body: { code, state },
    });
    tokenStore.set(data);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh_token = tokenStore.getLegacyRefresh();
    try {
      await api("/auth/logout", {
        method: "POST", auth: false, body: refresh_token ? { refresh_token } : undefined,
      });
    } catch {
      /* signing out locally is enough if the server is unreachable */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (current_password, new_password) => {
    const data = await api("/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    });
    tokenStore.set(data);
    setUser(data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api("/me");
    setUser(me);
    return me;
  }, []);

  const switchRole = useCallback(async (role) => {
    const data = await api("/auth/switch-role", {
      method: "POST",
      body: { role },
    });
    tokenStore.set(data);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginWithMicrosoft,
      logout,
      changePassword,
      refreshUser,
      switchRole,
    }),
    [user, loading, login, loginWithMicrosoft, logout, changePassword, refreshUser, switchRole]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
