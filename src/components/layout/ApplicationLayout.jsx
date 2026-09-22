import { Outlet } from "react-router-dom";
import { useAppNavigation } from "./useAppNavigation.js";
import AppShell from "./AppShell.jsx";
import Sidebar from "./Sidebar.jsx";

export default function ApplicationLayout({ routes = [] }) {
  const { items, activePath, onNavigate, sectionLabels, subtitle } =
    useAppNavigation(routes);

  return (
    <AppShell
      sidebar={
        <Sidebar
          items={items}
          activePath={activePath}
          onNavigate={onNavigate}
          sectionLabels={sectionLabels}
          subtitle={subtitle}
        />
      }
      maxWidth={null}
    >
      <Outlet />
    </AppShell>
  );
}
