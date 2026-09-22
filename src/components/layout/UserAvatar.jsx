import { useMemo } from "react";
import { ChevronDown, LogOut, User, Settings, Shield, Play } from "lucide-react";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
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

export default function UserAvatar({ onNavigate, variant = "responsive" }) {
  const { user, profile, roles, isAdmin, logout, hasRole } = useUserAuth();
  const isSidebar = variant === "sidebar";

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
      icon: <SpaceIcon size={16} className="text-gold" />,
      label: spaceInfo.label,
      onClick: () => onNavigate?.(spaceInfo.path),
      className: "font-semibold text-gold data-[highlighted]:text-gold focus:text-gold",
    },
    {
      icon: <Play size={16} className="text-navy" />,
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
        "border-t border-line pt-1 mt-1 font-semibold text-warning data-[highlighted]:bg-warning-soft data-[highlighted]:text-warning focus:text-warning",
    },
  ];

  return (
    <DropdownMenu
      items={items}
      align="right"
      side={isSidebar ? "top" : "bottom"}
      width={240}
      header={<span>Compte</span>}
      className={isSidebar ? "w-full" : undefined}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 bg-transparent font-sans",
            isSidebar
              ? "rounded-lg border border-transparent px-3 py-2.5 text-left text-sidebar-foreground hover:bg-sidebar-accent"
              : "w-auto rounded-md border border-border bg-card px-2.5 py-1.5 text-foreground"
          )}
        >
<div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-bold",
          isSidebar ? "h-9 w-9 text-[13px]" : "h-8 w-8 text-xs",
          isSidebar
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : isAdmin
              ? "bg-gradient-to-br from-primary to-secondary"
              : "bg-primary text-primary-foreground"
        )}
      >
        {initials}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col",
          isSidebar ? "flex-1" : ""
        )}
      >
        <span
          className={cn(
            "truncate font-semibold",
            isSidebar ? "text-[13px] text-sidebar-foreground" : "text-[12.5px] text-foreground"
          )}
        >
          {displayName}
        </span>
        <span
          className={cn(
            isSidebar
              ? "text-[11.5px] text-muted-foreground"
              : "text-[10.5px] text-muted-foreground"
          )}
        >
          {roleDisplayName}
        </span>
      </div>
      <ChevronDown
        size={isSidebar ? 16 : 14}
        className={cn(
          "shrink-0",
          isSidebar ? "text-muted-foreground" : "text-muted-foreground"
        )}
      />
    </button>
      )}
    />
  );
}
