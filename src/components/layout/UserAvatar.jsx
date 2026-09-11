import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, User, Settings, Shield } from "lucide-react";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
import { NAVY, GOLD, MUTED, LINE, CREAM, INK } from "../../lib/theme.js";

export default function UserAvatar({ onNavigate }) {
  const { user, profile, isAdmin, logout } = useUserAuth();
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

  const initials = (profile?.first_name?.[0] || "") + (profile?.last_name?.[0] || "") || user?.email?.[0]?.toUpperCase() || "U";
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Utilisateur";

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

  const goAdmin = () => {
    setOpen(false);
    onNavigate?.("/admin");
  };

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
          background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10,
          cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: INK,
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: isAdmin ? `linear-gradient(135deg, ${NAVY}, ${GOLD})` : NAVY,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 12,
        }}>
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </span>
          <span style={{ fontSize: 10.5, color: MUTED }}>{isAdmin ? "Administrateur" : "Candidat"}</span>
        </div>
        <ChevronDown size={14} color={MUTED} />
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "110%", right: 0, zIndex: 100, minWidth: 220,
            background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden"
          }}>
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
            {isAdmin && (
              <button onClick={goAdmin} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: "none", border: "none", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", fontSize: 13, color: GOLD, fontWeight: 600,
              }}>
                <Shield size={16} /> Espace administrateur
              </button>
            )}
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