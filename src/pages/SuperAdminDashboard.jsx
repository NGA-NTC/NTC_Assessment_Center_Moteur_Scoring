import { useState, useEffect, useMemo } from "react";
import { Users, Shield, Key, FileText, Settings, BarChart2, ChevronRight } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { getSuperAdminStats } from "../services/dashboard/index.js";
import { listAccounts, listImported, listHiddenStaticFiles } from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates } from "../lib/candidates.js";
import { NAVY, CREAM, INK, LINE, MUTED } from "../lib/theme.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Card from "../components/ui/Card.jsx";

const STAT_CARDS = [
  { key: "users", label: "Utilisateurs totaux", icon: Users, color: NAVY, path: "/super-admin/comptes" },
  { key: "roles", label: "Rôles configurés", icon: Shield, color: "#1A5C3D", path: "/super-admin/roles" },
  { key: "access", label: "Règles d'accès", icon: Key, color: "#5C3A1A", path: "/super-admin/acces" },
  { key: "pages", label: "Pages gérées", icon: FileText, color: "#3D1A5C", path: "/super-admin/pages" },
  { key: "features", label: "Fonctionnalités", icon: Settings, color: "#1A3D5C", path: "/super-admin/fonctionnalites" },
  { key: "results", label: "Module Résultats", icon: BarChart2, color: "#5C1A3D", path: "/admin" },
];

const QUICK_ACTIONS = [
  { label: "Gérer les comptes", description: "Voir, modifier, suspendre les utilisateurs", icon: Users, color: NAVY, path: "/super-admin/comptes" },
  { label: "Configurer les rôles", description: "Créer, modifier, supprimer les rôles", icon: Shield, color: "#1A5C3D", path: "/super-admin/roles" },
  { label: "Définir les accès", description: "Pages et fonctionnalités par rôle", icon: Key, color: "#5C3A1A", path: "/super-admin/acces" },
  { label: "Gérer les pages", description: "Pages accessibles de la plateforme", icon: FileText, color: "#3D1A5C", path: "/super-admin/pages" },
  { label: "Gérer les fonctionnalités", description: "Actions disponibles par page/rôle", icon: Settings, color: "#1A3D5C", path: "/super-admin/fonctionnalites" },
  { label: "Accéder aux résultats", description: "Module d'administration des résultats", icon: BarChart2, color: "#5C1A3D", path: "/admin" },
];

function StatCard({ label, value, icon: Icon, color, path }) {
  return (
    <Card onClick={() => window.location.href = path} style={{ cursor: "pointer", transition: "transform .15s, box-shadow .15s", borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: INK }}>{value}</div>
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={24} color={color} />
        </div>
      </div>
    </Card>
  );
}

function QuickAction({ label, description, icon: Icon, color, path }) {
  return (
    <Card onClick={() => window.location.href = path} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", transition: "transform .15s, box-shadow .15s", borderLeft: `4px solid ${color}` }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>{label}</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{description}</div>
      </div>
      <ChevronRight size={20} color={MUTED} />
    </Card>
  );
}

function getRoleDisplayName(roles) {
  if (!roles || roles.length === 0) return "Utilisateur";
  const priority = ["super_admin", "admin", "candidate"];
  const sorted = [...roles].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
  return sorted[0]?.name || sorted[0]?.id || "Utilisateur";
}

export default function SuperAdminDashboard() {
  const { user, profile, roles } = useUserAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  const displayName = useMemo(() => 
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Super Administrateur",
    [profile, user]
  );
  
  const roleDisplayName = useMemo(() => getRoleDisplayName(roles), [roles]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getSuperAdminStats();
        const [accounts, staticImports, runtimeImports, hiddenStatic] = await Promise.all([
          listAccounts(),
          listImportedResults(),
          listImported(),
          listHiddenStaticFiles(),
        ]);
        const results = buildCandidates({ accounts, staticImports, runtimeImports, hiddenStatic }).length;
        setStats({ ...data.totals, results });
        setRecentActivity(data.recentUsers);
      } catch (e) {
        console.error("Erreur chargement stats:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <PageTitle
        title="Tableau de bord Super Admin"
        subtitle={`${displayName} · ${roleDisplayName}`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        {STAT_CARDS.map((item) => (
          <StatCard
            key={item.key}
            label={item.label}
            value={stats[item.key] ?? (loading ? "—" : 0)}
            icon={item.icon}
            color={item.color}
            path={item.path}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Accès rapides</div>
          </div>
          <div style={{ padding: "16px 24px", display: "grid", gap: 12 }}>
            {QUICK_ACTIONS.map((item) => (
              <QuickAction key={item.path} {...item} />
            ))}
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Activité récente</div>
          </div>
          <div style={{ padding: "16px 24px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: MUTED }}>Chargement…</div>
            ) : recentActivity.length === 0 ? (
              <div style={{ textAlign: "center", color: MUTED, padding: "40px 0" }}>Aucune activité récente</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recentActivity.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "#FAFAFA", borderRadius: 8, border: `1px solid ${LINE}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                      {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                      </div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>
                        {u.email} · {u.role_ids?.join(", ") || "Aucun rôle"} · {u.status || "Actif"}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}