import { useLocation, useNavigate } from "react-router-dom";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
import { useEffectiveAuthority } from "../../hooks/auth/useEffectiveAuthority.js";
import {
  buildNavigation,
  findNavMatch,
  NAVIGATION_SECTION_LABELS,
  NAVIGATION_SECTION_SUBTITLES,
} from "../../routes/navigation/index.js";

export function useAppNavigation(routesList) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, hasRole } = useUserAuth();
  const { can } = useEffectiveAuthority();

  const items = buildNavigation(routesList, {
    user,
    isAdmin,
    hasRole,
    canPermission: can,
  });
  const activePath = location.pathname;
  const activeItem = findNavMatch(items, activePath);
  const subtitle = activeItem?.section
    ? (NAVIGATION_SECTION_SUBTITLES[activeItem.section] ?? activeItem.section)
    : "";

  return {
    items,
    activePath,
    onNavigate: navigate,
    sectionLabels: NAVIGATION_SECTION_LABELS,
    subtitle,
  };
}
