import { Navigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../../context/user-auth-hooks.js";
import { LoadingState } from "../../components/ui/States.jsx";

export default function UserRoute({ children }) {
  const { user, loading } = useUserAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState minHeight={480} label="Vérification de la session…" />;
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  return children;
}