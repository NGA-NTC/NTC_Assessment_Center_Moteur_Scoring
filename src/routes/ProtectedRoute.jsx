import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F4EC" }}>
        <div style={{ fontSize: 14, color: "#8A8578" }}>Chargement…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}