import { Navigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../../context/user-auth-hooks.js";
import { LoadingState } from "../../components/ui/States.jsx";

export default function SuperAdminRoute({ children }) {
  const { hasRole, loading } = useUserAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState minHeight={480} label="Vérification de la session…" />;
  }

  if (!hasRole("super_admin")) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
