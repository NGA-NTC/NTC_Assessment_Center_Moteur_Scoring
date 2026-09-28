import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/admin-auth-hooks.js";
import { LoadingState } from "../../components/ui/States.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState minHeight={480} label="Vérification de la session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}