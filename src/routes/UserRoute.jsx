import { Navigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext.jsx";

export default function UserRoute({ children }) {
  const { user, loading } = useUserAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F4EC" }}>
        <div style={{ fontSize: 14, color: "#8A8578" }}>Chargement…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  return children;
}