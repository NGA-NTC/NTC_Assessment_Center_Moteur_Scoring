import { routes } from "../../routes/registry/index.jsx";
import { useAppNavigation } from "./useAppNavigation.js";
import Sidebar from "./Sidebar.jsx";

export default function SuperAdminSidebar() {
  const nav = useAppNavigation(routes);
  return <Sidebar {...nav} subtitle="Super Admin" />;
}
