import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, LogOut, User, Settings, Shield, Play } from "lucide-react";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
import { NAVY, GOLD, MUTED, LINE, CREAM, INK } from "../../lib/theme.js";

function getRoleDisplayName(roles) {
  if (!roles || roles.length === 0) return "Utilisateur";
  const priority = ["super_admin", "admin", "candidate"];
  const sorted = [...roles].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
  return sorted[0]?.name || sorted[0]?.id || "Utilisateur";
}

function getSpaceInfo(roles, hasRole) {
  if (hasRole("super_admin")) {
    return { label: "Espace Super Admin", path: "/super-admin", icon: Shield };
  }
  if (hasRole("admin")) {
    return { label: "Espace administrateur", path: "/admin", icon: Shield };
  }
  if (hasRole("candidate")) {
    return { label: "Mon espace candidat", path: "/test", icon: Play };
  }
  return { label: "Espace", path: "/", icon: Shield };
}

export default function UserAvatar({ onNavigate, variant = "responsive" }) {
  const { user, profile, roles, isAdmin, logout, hasRole } = useUserAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = useMemo(() => 
    (profile?.first_name?.[0] || "") + (profile?.last_name?.[0] || "") || user?.email?.[0]?.toUpperCase() || "U",
    [profile, user]
  );
  const displayName = useMemo(() => 
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Utilisateur",
    [profile, user]
  );
  const roleDisplayName = useMemo(() => getRoleDisplayName(roles), [roles]);
  const spaceInfo = useMemo(() => getSpaceInfo(roles, hasRole), [roles, hasRole]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    onNavigate?.("/connexion");
  };

  const goProfile = () => {
    setOpen(false);
    onNavigate?.("/compte");
  };

  const goChangePassword = () => {
    setOpen(false);
    onNavigate?.("/modifier-mot-de-passe");
  };

  const goSpace = () => {
    setOpen(false);
    onNavigate?.(spaceInfo.path);
  };

  const goTest = () => {
    setOpen(false);
    onNavigate?.("/test");
  };

  const isSidebar = variant === "sidebar";

  const buttonStyle = useMemo(() => ({
    display: "flex", alignItems: "center", gap: 10, padding: isSidebar ? "10px 12px" : "6px 10px",
    background: isSidebar ? "transparent" : "#fff", border: isSidebar ? "none" : `1px solid ${LINE}`, borderRadius: isSidebar ? 8 : 10,
    cursor: "pointer", fontFamily: "inherit", fontSize: isSidebar ? 13 : 13, color: isSidebar ? "#fff" : INK,
    width: isSidebar ? "100%" : "auto", textAlign: isSidebar ? "left" : "inherit",
  }), [isSidebar]);

  const avatarBg = useMemo(() => isAdmin ? `linear-gradient(135deg, ${NAVY}, ${GOLD})` : NAVY, [isAdmin]);

  const dropdownStyle = useMemo(() => ({
    position: "absolute", top: isSidebar ? "auto" : "110%", bottom: isSidebar ? "110%" : "auto", right: 0, zIndex: 100, minWidth: 240,
    background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden"
  }), [isSidebar]);

  const SpaceIcon = spaceInfo.icon;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={buttonStyle}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div style={{
          width: isSidebar ? 36 : 32, height: isSidebar ? 36 : 32, borderRadius: "50%",
          background: avatarBg,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: isSidebar ? 13 : 12,
        }}>
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: isSidebar ? 1 : 0 }}>
          <span style={{ fontWeight: 600, fontSize: isSidebar ? 13 : 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isSidebar ? "#fff" : INK }}>
            {displayName}
          </span>
          <span style={{ fontSize: isSidebar ? 11.5 : 10.5, color: isSidebar ? "rgba(255,255,255,0.7)" : MUTED }}>
            {roleDisplayName}
          </span>
        </div>
        <ChevronDown size={isSidebar ? 16 : 14} color={isSidebar ? "rgba(255,255,255,0.7)" : MUTED} />
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={dropdownStyle}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${LINE}`, background: CREAM }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Compte</div>
            </div>
            <button onClick={goProfile} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: "none", border: "none", cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", fontSize: 13, color: INK,
            }}>
              <User size={16} color={MUTED} /> Mon compte
            </button>
            <button onClick={goChangePassword} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: "none", border: "none", cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", fontSize: 13, color: INK,
            }}>
              <Settings size={16} color={MUTED} /> Modifier le mot de passe
            </button>
            <button onClick={goSpace} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: "none", border: "none", cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", fontSize: 13, color: GOLD, fontWeight: 600,
            }}>
              <SpaceIcon size={16} /> {spaceInfo.label}
            </button>
            <button onClick={goTest} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: "none", border: "none", cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", fontSize: 13, color: INK,
            }}>
              <Play size={16} color={NAVY} /> Passer le test
            </button>
            <div style={{ borderTop: `1px solid ${LINE}`, padding: "4px" }}>
              <button onClick={handleLogout} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: "none", border: "none", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", fontSize: 13, color: "#B5652E",
              }}>
                <LogOut size={16} /> Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}