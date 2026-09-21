import { Navigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../../context/UserAuthContext.jsx";

export default function SuperAdminRoute({ children }) {
  const { hasRole, loading } = useUserAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F4EC" }}>
        <div style={{ fontSize: 14, color: "#8A8578" }}>Chargement…</div>
      </div>
    );
  }

  if (!hasRole("super_admin")) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}