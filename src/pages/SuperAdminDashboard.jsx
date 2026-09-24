import { useState, useEffect, useMemo } from "react";
import { Users, Shield, Key, FileText, Settings, BarChart2, ChevronRight, Activity } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { getSuperAdminStats } from "../services/dashboard/index.js";
import { listAccounts, listImported, listHiddenStaticFiles } from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates } from "../lib/candidates.js";
import { NAVY, colors } from "../lib/theme.js";
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
      className="flex w-full cursor-pointer items-center gap-3.5 border border-border bg-surface p-4 transition-[border-color,box-shadow,transform] duration-150"
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}15` }}
      >
        <Icon size={20} color={color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-foreground">{label}</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-cream px-6 py-[18px]">
        <div className="font-serif text-[16px] font-semibold text-foreground">{title}</div>
        {action}
      </div>
      <div className="p-6">{children}</div>
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

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-5">
        <CardSection title="Accès rapides">
          <div className="grid gap-2.5">
            {QUICK_ACTIONS.map((item) => (
              <QuickAction key={item.path} {...item} />
            ))}
          </div>
        </CardSection>

        <CardSection
          title="Activité récente"
          action={<Activity size={16} className="text-muted-foreground" />}
        >
          {loading ? (
            <LoadingState minHeight={200} label="Chargement de l'activité…" />
          ) : recentActivity.length === 0 ? (
            <EmptyState title="Aucune activité récente" description="Les nouveaux comptes créer récemment apparaîtront ici." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {recentActivity.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-line-soft p-3"
                >
                  <Avatar
                    name={`${u.first_name || ""} ${u.last_name || ""}`.trim()}
                    email={u.email}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-foreground">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {u.email} · {u.role_ids?.join(", ") || "Aucun rôle"} · {u.status || "Actif"}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-muted-foreground">
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