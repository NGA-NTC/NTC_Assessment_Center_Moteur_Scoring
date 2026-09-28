import { useMemo } from "react";
import { ChevronDown, LogOut, User, Settings, Shield, Play } from "lucide-react";
import { useUserAuth } from "../../context/user-auth-hooks.js";
import DropdownMenu from "../ui/DropdownMenu.jsx";
import { cn } from "@/lib/utils";

function getRoleDisplayName(roles) {
  if (!roles || roles.length === 0) return "Utilisateur";
  const priority = ["super_admin", "admin", "candidate"];
  const sorted = [...roles].sort(
    (a, b) => priority.indexOf(a.id) - priority.indexOf(b.id)
  );
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

export default function UserAvatar({ onNavigate }) {
  const { user, profile, roles, logout, hasRole } = useUserAuth();

  const initials = useMemo(
    () =>
      (profile?.first_name?.[0] || "") + (profile?.last_name?.[0] || "") ||
      user?.email?.[0]?.toUpperCase() ||
      "U",
    [profile, user]
  );
  const displayName = useMemo(
    () =>
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      user?.email ||
      "Utilisateur",
    [profile, user]
  );
  const roleDisplayName = useMemo(() => getRoleDisplayName(roles), [roles]);
  const spaceInfo = useMemo(
    () => getSpaceInfo(roles, hasRole),
    [roles, hasRole]
  );

  const SpaceIcon = spaceInfo.icon;

  const items = [
    {
      icon: <User size={16} />,
      label: "Mon compte",
      onClick: () => onNavigate?.("/compte"),
    },
    {
      icon: <Settings size={16} />,
      label: "Modifier le mot de passe",
      onClick: () => onNavigate?.("/modifier-mot-de-passe"),
    },
    {
      icon: <SpaceIcon size={16} className="text-secondary" />,
      label: spaceInfo.label,
      onClick: () => onNavigate?.(spaceInfo.path),
      className: "font-semibold text-secondary data-[highlighted]:text-secondary focus:text-secondary",
    },
    {
      icon: <Play size={16} className="text-primary" />,
      label: "Passer le test",
      onClick: () => onNavigate?.("/test"),
    },
    {
      icon: <LogOut size={16} className="text-warning" />,
      label: "Déconnexion",
      onClick: async () => {
        await logout();
        onNavigate?.("/connexion");
      },
      className:
        "border-t border-border pt-1 mt-1 font-semibold text-warning data-[highlighted]:bg-warning-soft data-[highlighted]:text-warning focus:text-warning",
    },
  ];

  return (
    <DropdownMenu
      items={items}
      align="right"
      side="top"
      width={240}
      header={<span>Compte</span>}
      className="w-full"
      trigger={({ open }) => (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent bg-transparent px-3 py-2.5 text-left font-sans text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
            open && "bg-sidebar-accent"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[13px] font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold text-sidebar-foreground">{displayName}</span>
            <span className="text-[11.5px] text-muted-foreground">{roleDisplayName}</span>
          </div>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        </button>
      )}
    />
  );
}
