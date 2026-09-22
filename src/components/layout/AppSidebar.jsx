import { routes } from "../../routes/registry/index.jsx";
import { useAppNavigation } from "./useAppNavigation.js";
import Sidebar from "./Sidebar.jsx";

export default function AppSidebar() {
  const nav = useAppNavigation(routes);
  return <Sidebar {...nav} />;
}
