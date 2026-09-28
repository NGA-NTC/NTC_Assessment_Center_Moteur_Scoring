import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { signUpAccount } from "../services/auth/signUp.js";
import { ensureLocalAccount } from "../lib/storage.js";
import { UserAuthContext } from "./user-auth-context.js";

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- Chargement de la session au montage + écoute des changements ----
  useEffect(() => {
    let mounted = true;

    const loadProfileAndRoles = async (sessionUser) => {
      if (!sessionUser) {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        return;
      }
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sessionUser.id)
          .single();
        if (mounted) setProfile(profileData ?? null);

        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role_id, roles(id, name, is_system)")
          .eq("user_id", sessionUser.id);
        const mappedRoles = (roleRows ?? []).map((r) => r.roles).filter(Boolean);
        if (mounted) setRoles(mappedRoles);

        const roleIds = mappedRoles.map((r) => r.id);
        if (roleIds.length > 0) {
          const { data: permRows } = await supabase
            .from("role_permissions")
            .select("permission_id")
            .in("role_id", roleIds);
          const permIds = [...new Set((permRows ?? []).map((p) => p.permission_id))];
          if (permIds.length > 0) {
            const { data: perms } = await supabase
              .from("permissions")
              .select("id, name")
              .in("id", permIds);
            if (mounted) setPermissions(perms ?? []);
          } else if (mounted) {
            setPermissions([]);
          }
        } else if (mounted) {
          setPermissions([]);
        }
      } catch {
        // profil/rôles indisponibles : session conservée, données vides
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
      loadProfileAndRoles(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      loadProfileAndRoles(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ---- Actions d'authentification ----
  const register = useCallback(async (email, password) => {
    if (!email || !email.includes("@")) return { error: "Veuillez saisir un email valide." };
    if (!password || password.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };

    const res = await signUpAccount(supabase, { email, password });
    if (res.error) return { error: res.error };
    if (res.confirmationRequired) {
      // Miroir local créé même avant confirmation : l'autosave du questionnaire
      // et la liste Résultats s'appuient sur cet enregistrement.
      await ensureLocalAccount(email);
    }
    return { ok: true };
  }, []);

  const login = useCallback(async (email, password) => {
    if (!email || !password) return { error: "Veuillez saisir votre email et votre mot de passe." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    if (!newPassword || newPassword.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!email || !email.includes("@")) return { error: "Veuillez saisir un email valide." };
    const configuredSiteUrl = String(import.meta.env.VITE_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
    const siteUrl = configuredSiteUrl || window.location.origin;
    const redirectTo = `${siteUrl}/reinitialiser-mot-de-passe`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const updateProfile = useCallback(async (patch) => {
    if (!user) return { error: "Non connecté." };
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) return { error: error.message };
    setProfile((prev) => ({ ...prev, ...patch }));
    return { ok: true };
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data ?? null);
  }, [user]);

  // ---- Dérivés ----
  const hasRole = useCallback((roleId) => roles.some((r) => r.id === roleId), [roles]);
  const hasPermission = useCallback((permId) => permissions.some((p) => p.id === permId), [permissions]);

  const isAdmin = useMemo(() => hasRole("admin") || hasRole("super_admin"), [hasRole]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    roles,
    permissions,
    loading,
    register,
    login,
    logout,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    hasRole,
    hasPermission,
    isAdmin,
  }), [user, session, profile, roles, permissions, loading, register, login, logout, resetPassword, updatePassword, updateProfile, refreshProfile, hasRole, hasPermission, isAdmin]);

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}
