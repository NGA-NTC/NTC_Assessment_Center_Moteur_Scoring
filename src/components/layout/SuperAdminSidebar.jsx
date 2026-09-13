import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Key, 
  FileText, 
  Settings, 
  BarChart2, 
  User,
  Play,
} from "lucide-react";
import { NAVY, GOLD, SERIF } from "../../lib/theme.js";
import { useNavigate, useLocation } from "react-router-dom";
import UserAvatar from "./UserAvatar.jsx";

const NAV_ITEMS = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, path: "/super-admin" },
  { key: "accounts", label: "Comptes", icon: Users, path: "/super-admin/comptes" },
  { key: "roles", label: "Rôles", icon: Shield, path: "/super-admin/roles" },
  { key: "access", label: "Accès", icon: Key, path: "/super-admin/acces" },
  { key: "pages", label: "Pages", icon: FileText, path: "/super-admin/pages" },
  { key: "features", label: "Fonctionnalités", icon: Settings, path: "/super-admin/fonctionnalites" },
  { key: "results", label: "Résultats", icon: BarChart2, path: "/admin" },
];

export default function SuperAdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const goAdmin = () => {
    navigate("/super-admin");
  };

  const goProfile = () => {
    navigate("/compte");
  };

  const goChangePassword = () => {
    navigate("/modifier-mot-de-passe");
  };

  const goTest = () => {
    navigate("/test");
  };

  return (
    <div className="super-admin-sidebar app-sidebar" style={{ width: "100%", maxWidth: 280, flexShrink: 0, background: NAVY, color: "#fff", display: "flex", flexDirection: "column", height: "100%" }}>
      <button type="button" onClick={goAdmin} className="app-sidebar__brand" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontFamily: "inherit", padding: "20px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, letterSpacing: 0.2 }}>NTC Assessment</div>
        <div style={{ fontSize: 11, color: GOLD, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>Super Admin</div>
      </button>

      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px 0" }}>
        <div style={{ fontSize: 10.5, color: GOLD, textTransform: "uppercase", letterSpacing: 0.6, padding: "8px 12px 4px" }}>NAVIGATION</div>
        
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== "/super-admin" && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2,
                borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
                transition: "background .15s", fontFamily: "inherit", fontSize: 13, color: "#fff",
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>
              {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }} />}
            </button>
          );
        })}

        <button
          onClick={goTest}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2,
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: "transparent",
            transition: "background .15s", fontFamily: "inherit", fontSize: 13, color: "#fff",
          }}
        >
          <Play size={18} color={GOLD} />
          <span>Passer le test</span>
        </button>
      </nav>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", padding: "8px 8px 0" }}>
        <div style={{ fontSize: 10.5, color: "#B8C0D4", textTransform: "uppercase", letterSpacing: 0.6, padding: "0 12px 8px" }}>COMPTE</div>
        <button
          onClick={goProfile}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2,
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: "transparent",
            transition: "background .15s", fontFamily: "inherit", fontSize: 13, color: "#fff",
          }}
        >
          <User size={18} />
          <span>Mon compte</span>
        </button>
        <button
          onClick={goChangePassword}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2,
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: "transparent",
            transition: "background .15s", fontFamily: "inherit", fontSize: 13, color: "#fff",
          }}
        >
          <Settings size={18} />
          <span>Modifier le mot de passe</span>
        </button>
      </div>

      <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <UserAvatar variant="sidebar" onNavigate={navigate} />
      </div>
    </div>
  );
}