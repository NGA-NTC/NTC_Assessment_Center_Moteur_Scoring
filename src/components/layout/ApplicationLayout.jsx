import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { CREAM, INK, SANS } from "../../lib/theme.js";
import { useUserAuth } from "../../context/UserAuthContext.jsx";
import { useEffectiveAuthority } from "../../hooks/auth/useEffectiveAuthority.js";
import { buildNavigation, findNavMatch, NAVIGATION_SECTION_LABELS, NAVIGATION_SECTION_SUBTITLES } from "../../routes/navigation/index.js";
import Sidebar from "./Sidebar.jsx";

const SECTION_LABELS = NAVIGATION_SECTION_LABELS;
const SECTION_SUBTITLES = NAVIGATION_SECTION_SUBTITLES;

export default function ApplicationLayout({ routes = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, hasRole } = useUserAuth();
  const { can } = useEffectiveAuthority();

  const items = buildNavigation(routes, { user, isAdmin, hasRole, canPermission: can });
  const activeItem = findNavMatch(items, location.pathname);
  const subtitle = activeItem?.section ? SECTION_SUBTITLES[activeItem.section] ?? activeItem.section : "";

  return (
    <div className="super-admin-shell" style={{ display: "flex", minHeight: "100svh", width: "100%", background: CREAM, fontFamily: SANS, color: INK, overflowX: "clip" }}>
      <div className="super-admin-shell__sidebar">
        <Sidebar
          items={items}
          activePath={location.pathname}
          onNavigate={navigate}
          sectionLabels={SECTION_LABELS}
          subtitle={subtitle}
        />
      </div>
      <div className="super-admin-shell__main" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="super-admin-shell__content" style={{ flex: 1, padding: "28px 26px", maxWidth: "100%", width: "100%" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}