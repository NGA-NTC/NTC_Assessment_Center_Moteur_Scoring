import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";

const UserAuthContext = createContext(null);

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && data) setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  const fetchRoles = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role_id, roles(id, name, description)")
        .eq("user_id", userId);
      if (!error && data) {
        const roleList = data.map((r) => r.roles).filter(Boolean);
        setRoles(roleList);
        const roleIds = roleList.map((r) => r.id);
        if (roleIds.length > 0) {
          const { data: permData } = await supabase
            .from("role_permissions")
            .select("permission_id, permissions(id, name, description, category)")
            .in("role_id", roleIds);
          if (permData) {
            const perms = permData.map((p) => p.permissions).filter(Boolean);
            setPermissions(perms);
          }
        }
      }
    } catch {
      setRoles([]);
      setPermissions([]);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!user) return;
    await Promise.all([fetchProfile(user.id), fetchRoles(user.id)]);
  }, [user, fetchProfile, fetchRoles]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
        await fetchRoles(session.user.id);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRoles]);

  const register = useCallback(async (email, password) => {
    if (!email || !email.includes("@")) return { error: "Veuillez saisir un email valide." };
    if (!password || password.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };

    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    if (data.user && !data.session) {
      return { error: "Un email de confirmation vous a été envoyé. Confirmez votre adresse email avant de vous connecter." };
    }
    return { ok: true };
  }, []);

  const login = useCallback(async (email, password) => {
    if (!email || !password) return { error: "Veuillez saisir votre email et votre mot de passe." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!email || !email.includes("@")) return { error: "Veuillez saisir un email valide." };
    const redirectTo = `${window.location.origin}/reinitialiser-mot-de-passe`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    if (!newPassword || newPassword.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return { error: "Non connecté." };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (error) return { error: error.message };
    await fetchProfile(user.id);
    return { ok: true };
  }, [user, fetchProfile]);

  const hasRole = useCallback((roleId) => roles.some((r) => r.id === roleId), [roles]);
  const hasPermission = useCallback((permId) => permissions.some((p) => p.id === permId), [permissions]);

  const isAdmin = useMemo(() => hasRole("admin"), [hasRole, roles]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    roles,
    permissions,
    loading,
    isAdmin,
    hasRole,
    hasPermission,
    register,
    login,
    logout,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshUserData,
  }), [
    user, session, profile, roles, permissions, loading,
    isAdmin, hasRole, hasPermission,
    register, login, logout, resetPassword, updatePassword, updateProfile, refreshUserData
  ]);

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth doit être utilisé dans un UserAuthProvider");
  return ctx;
}