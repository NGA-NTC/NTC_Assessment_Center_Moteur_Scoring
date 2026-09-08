import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext.jsx";
import { UserAuthProvider } from "../context/UserAuthContext.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import UserRoute from "./UserRoute.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import UserLogin from "../pages/UserLogin.jsx";
import TestApp from "../pages/TestApp.jsx";
import AdminResultats from "../pages/AdminResultats.jsx";
import AdminResponses from "../pages/AdminResponses.jsx";

export default function AppRoutes() {
  return (
    <UserAuthProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/connexion" replace />} />
            <Route path="/connexion" element={<UserLogin />} />
            <Route path="/inscription" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/test"
              element={
                <UserRoute>
                  <TestApp />
                </UserRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminResultats />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reponses/:candidateId"
              element={
                <ProtectedRoute>
                  <AdminResponses />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/connexion" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </UserAuthProvider>
  );
}