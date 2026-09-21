import { useLocation, useNavigate } from "react-router-dom";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
import { useEffectiveAuthority } from "../../hooks/auth/useEffectiveAuthority.js";
import { routes } from "../../routes/registry/index.jsx";
import { buildNavigation, NAVIGATION_SECTION_LABELS } from "../../routes/navigation/index.js";
import Sidebar from "./Sidebar.jsx";

export default function SuperAdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, hasRole } = useUserAuth();
  const { can } = useEffectiveAuthority();

  const items = buildNavigation(routes, { user, isAdmin, hasRole, canPermission: can });

  return (
    <Sidebar
      items={items}
      activePath={location.pathname}
      onNavigate={navigate}
      sectionLabels={NAVIGATION_SECTION_LABELS}
      subtitle="Super Admin"
    />
  );
}