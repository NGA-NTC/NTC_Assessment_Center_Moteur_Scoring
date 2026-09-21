import { useLocation } from "react-router-dom";
import { useDocumentTitle } from "../hooks/ui/useDocumentTitle.js";
import { routes } from "./registry/index.jsx";
import { getRouteByPath } from "./navigation/index.js";

export default function DocumentTitleSync() {
  const location = useLocation();
  const route = getRouteByPath(routes, location.pathname);

  useDocumentTitle(route?.titleKey);

  return null;
}