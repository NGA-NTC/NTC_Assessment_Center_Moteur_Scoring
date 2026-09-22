import { useState, useEffect, useMemo } from "react";
import { Users, Shield, Key, FileText, Settings, BarChart2, ChevronRight, Activity } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { getSuperAdminStats } from "../services/dashboard/index.js";
import { listAccounts, listImported, listHiddenStaticFiles } from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates } from "../lib/candidates.js";
import { NAVY, colors, radius, type } from "../lib/theme.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Card from "../components/ui/Card.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import StatCard from "../components/common/StatCard.jsx";
import { LoadingState, EmptyState } from "../components/ui/States.jsx";

const STAT_CARDS = [
  { key: "users", label: "Utilisateurs totaux", icon: Users, color: NAVY, path: "/super-admin/comptes" },
  { key: "roles", label: "Rôles configurés", icon: Shield, color: colors.info2, path: "/super-admin/roles" },
  { key: "access", label: "Règles d'accès", icon: Key, color: colors.info3, path: "/super-admin/acces" },
  { key: "pages", label: "Pages gérées", icon: FileText, color: colors.info4, path: "/super-admin/pages" },
  { key: "features", label: "Fonctionnalités", icon: Settings, color: colors.info, path: "/super-admin/fonctionnalites" },
  { key: "results", label: "Module Résultats", icon: BarChart2, color: colors.info5, path: "/admin" },
];

const QUICK_ACTIONS = [
  { label: "Gérer les comptes", description: "Voir, modifier, suspendre les utilisateurs", icon: Users, color: NAVY, path: "/super-admin/comptes" },
  { label: "Configurer les rôles", description: "Créer, modifier, supprimer les rôles", icon: Shield, color: colors.info2, path: "/super-admin/roles" },
  { label: "Définir les accès", description: "Pages et fonctionnalités par rôle", icon: Key, color: colors.info3, path: "/super-admin/acces" },
  { label: "Gérer les pages", description: "Pages accessibles de la plateforme", icon: FileText, color: colors.info4, path: "/super-admin/pages" },
  { label: "Gérer les fonctionnalités", description: "Actions disponibles par page/rôle", icon: Settings, color: colors.info, path: "/super-admin/fonctionnalites" },
  { label: "Accéder aux résultats", description: "Module d'administration des résultats", icon: BarChart2, color: colors.info5, path: "/admin" },
];

function QuickAction({ label, description, icon: Icon, color, path }) {
  return (
    <div
      onClick={() => { window.location.href = path; }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        cursor: "pointer",
        transition: "transform .15s, box-shadow .15s, border-color .15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; }}
    >
      <div style={{ width: 44, height: 44, borderRadius: radius.lg, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: type.fontSize.lg, fontWeight: type.fontWeight.semibold, color: colors.foreground }}>{label}</div>
        <div style={{ fontSize: type.fontSize.smMd, color: colors.mutedForeground, marginTop: 2 }}>{description}</div>
      </div>
      <ChevronRight size={18} color={colors.mutedForeground} />
    </div>
  );
}

function getRoleDisplayName(roles) {
  if (!roles || roles.length === 0) return "Utilisateur";
  const first = roles[0];
  return first?.name || first?.id || "Utilisateur";
}

function CardSection({ title, action, children }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${colors.border}`, background: colors.cream, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: type.fontSize.xl, fontWeight: type.fontWeight.semibold, color: colors.foreground }}>{title}</div>
        {action}
      </div>
      <div style={{ padding: "16px 24px" }}>{children}</div>
    </Card>
  );
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
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
        <CardSection title="Accès rapides">
          <div style={{ display: "grid", gap: 10 }}>
            {QUICK_ACTIONS.map((item) => (
              <QuickAction key={item.path} {...item} />
            ))}
          </div>
        </CardSection>

        <CardSection
          title="Activité récente"
          action={<Activity size={16} color={colors.mutedForeground} />}
        >
          {loading ? (
            <LoadingState minHeight={200} label="Chargement de l'activité…" />
          ) : recentActivity.length === 0 ? (
            <EmptyState title="Aucune activité récente" description="Les nouveaux comptes créer récemment apparaîtront ici." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentActivity.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px",
                    background: colors.nearlyBlack,
                    borderRadius: radius.sm,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <Avatar
                    name={`${u.first_name || ""} ${u.last_name || ""}`.trim()}
                    email={u.email}
                    size={40}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: type.fontSize.baseMd, fontWeight: type.fontWeight.semibold, color: colors.foreground, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </div>
                    <div style={{ fontSize: type.fontSize.sm, color: colors.mutedForeground }}>
                      {u.email} · {u.role_ids?.join(", ") || "Aucun rôle"} · {u.status || "Actif"}
                    </div>
                  </div>
                  <span style={{ fontSize: type.fontSize.sm, color: colors.mutedForeground, whiteSpace: "nowrap" }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardSection>
      </div>
    </div>
  );
}