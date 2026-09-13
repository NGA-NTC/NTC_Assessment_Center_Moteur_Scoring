import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserAuthProvider } from "../context/UserAuthContext.jsx";
import { AdminAuthProvider } from "../context/AdminAuthContext.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import SuperAdminRoute from "./SuperAdminRoute.jsx";
import UserRoute from "./UserRoute.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import UserLogin from "../pages/UserLogin.jsx";
import ForgotPassword from "../pages/ForgotPassword.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import ChangePassword from "../pages/ChangePassword.jsx";
import Profile from "../pages/Profile.jsx";
import TestApp from "../pages/TestApp.jsx";
import AdminResultats from "../pages/AdminResultats.jsx";
import AdminUsers from "../pages/AdminUsers.jsx";
import ModeTest from "../pages/ModeTest.jsx";
import SuperAdminLayout from "../components/layout/SuperAdminLayout.jsx";
import SuperAdminDashboard from "../pages/SuperAdminDashboard.jsx";
import SuperAdminAccounts from "../pages/SuperAdminAccounts.jsx";
import SuperAdminRoles from "../pages/SuperAdminRoles.jsx";
import SuperAdminAccess from "../pages/SuperAdminAccess.jsx";
import SuperAdminPages from "../pages/SuperAdminPages.jsx";
import SuperAdminFeatures from "../pages/SuperAdminFeatures.jsx";

export default function AppRoutes() {
  return (
    <UserAuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/connexion" replace />} />
            <Route path="/connexion" element={<UserLogin />} />
            <Route path="/inscription" element={<Register />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
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
              path="/modifier-mot-de-passe"
              element={
                <UserRoute>
                  <ChangePassword />
                </UserRoute>
              }
            />
            <Route
              path="/compte"
              element={
                <UserRoute>
                  <Profile />
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
              path="/admin/utilisateurs"
              element={
                <ProtectedRoute>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/mode-test/:id"
              element={
                <ProtectedRoute>
                  <ModeTest />
                </ProtectedRoute>
              }
            />
            <Route element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/comptes" element={<SuperAdminAccounts />} />
              <Route path="/super-admin/roles" element={<SuperAdminRoles />} />
              <Route path="/super-admin/acces" element={<SuperAdminAccess />} />
              <Route path="/super-admin/pages" element={<SuperAdminPages />} />
              <Route path="/super-admin/fonctionnalites" element={<SuperAdminFeatures />} />
            </Route>
            <Route path="*" element={<Navigate to="/connexion" replace />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </UserAuthProvider>
  );
}