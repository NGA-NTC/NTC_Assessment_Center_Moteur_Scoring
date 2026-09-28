import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { AdminAuthContext } from "./admin-auth-context.js";

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);

  const checkAdmin = useCallback(async (session) => {
    if (!session?.user) return false;
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role_id, roles(name)")
        .eq("user_id", session.user.id);
      const roleNames = (data ?? []).map((r) => r.roles?.name).filter(Boolean);
      const isAdminRole = roleNames.includes("Administrateur") || roleNames.includes("Super Administrateur");
      setAdminUser(isAdminRole ? { id: session.user.id, email: session.user.email, roles: roleNames } : null);
      return isAdminRole;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session ?? null;
      if (session) {
        const ok = await checkAdmin(session);
        setIsAuthenticated(ok);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      if (nextSession) {
        const ok = await checkAdmin(nextSession);
        setIsAuthenticated(ok);
      } else {
        setIsAuthenticated(false);
        setAdminUser(null);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const login = useCallback(async (email, password) => {
    if (!email || !password) return { error: "Veuillez saisir votre email et votre mot de passe." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    const { data } = await supabase.auth.getSession();
    const ok = await checkAdmin(data.session);
    if (!ok) {
      await supabase.auth.signOut();
      return { error: "Accès réservé aux administrateurs." };
    }
    setIsAuthenticated(true);
    return { ok: true };
  }, [checkAdmin]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAdminUser(null);
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    adminUser,
    loading,
    login,
    logout,
  }), [isAuthenticated, adminUser, loading, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
