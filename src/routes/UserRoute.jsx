import { Navigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext.jsx";

export default function UserRoute({ children }) {
  const { currentUser } = useUserAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  return children;
}