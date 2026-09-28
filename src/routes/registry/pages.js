import { lazy } from "react";

/**
 * Pages en code splitting — ce module n'exporte que des composants lazy
 * (exigé par react-refresh/only-export-components). Le Suspense/fallback
 * est géré dans routes/index.jsx via LazyPage.
 */
export const UserLogin = lazy(() => import("../../pages/UserLogin.jsx"));
export const Register = lazy(() => import("../../pages/Register.jsx"));
export const ForgotPassword = lazy(() => import("../../pages/ForgotPassword.jsx"));
export const ResetPassword = lazy(() => import("../../pages/ResetPassword.jsx"));
export const Login = lazy(() => import("../../pages/Login.jsx"));
export const TestApp = lazy(() => import("../../pages/TestApp.jsx"));
export const ChangePassword = lazy(() => import("../../pages/ChangePassword.jsx"));
export const Profile = lazy(() => import("../../pages/Profile.jsx"));
export const AdminResultats = lazy(() => import("../../pages/AdminResultats.jsx"));
export const AdminUsers = lazy(() => import("../../pages/AdminUsers.jsx"));
export const ModeTest = lazy(() => import("../../pages/ModeTest.jsx"));
export const SuperAdminDashboard = lazy(() => import("../../pages/SuperAdminDashboard.jsx"));
export const SuperAdminAccounts = lazy(() => import("../../pages/SuperAdminAccounts.jsx"));
export const SuperAdminRoles = lazy(() => import("../../pages/SuperAdminRoles.jsx"));
export const SuperAdminAccess = lazy(() => import("../../pages/SuperAdminAccess.jsx"));
export const SuperAdminPages = lazy(() => import("../../pages/SuperAdminPages.jsx"));
export const SuperAdminFeatures = lazy(() => import("../../pages/SuperAdminFeatures.jsx"));
