import { useLocation, useNavigate } from "react-router-dom";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
import { useEffectiveAuthority } from "../../hooks/auth/useEffectiveAuthority.js";
import { routes } from "../../routes/registry/index.jsx";
import {
  buildNavigation,
  findNavMatch,
  NAVIGATION_SECTION_SUBTITLES,
  NAVIGATION_SECTION_LABELS,
} from "../../routes/navigation/index.js";
import Sidebar from "./Sidebar.jsx";

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, hasRole } = useUserAuth();
  const { can } = useEffectiveAuthority();

  const items = buildNavigation(routes, { user, isAdmin, hasRole, canPermission: can });
  const activeItem = findNavMatch(items, location.pathname);

  const subtitle = activeItem?.section
    ? (NAVIGATION_SECTION_SUBTITLES[activeItem.section] ?? null)
    : null;

  return (
    <Sidebar
      items={items}
      activePath={location.pathname}
      onNavigate={navigate}
      sectionLabels={NAVIGATION_SECTION_LABELS}
      subtitle={subtitle}
    />
  );
}