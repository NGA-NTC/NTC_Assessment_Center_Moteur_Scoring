import { Navigate } from "react-router-dom";
import {
  BarChart2,
  FileText,
  Key,
  LayoutDashboard,
  Play,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";

// Pages en code splitting — déclarations centralisées dans ./pages.js (react-refresh friendly).
import {
  UserLogin,
  Register,
  ForgotPassword,
  ResetPassword,
  Login,
  TestApp,
  ChangePassword,
  Profile,
  AdminResultats,
  AdminUsers,
  ModeTest,
  SuperAdminDashboard,
  SuperAdminAccounts,
  SuperAdminRoles,
  SuperAdminAccess,
  SuperAdminPages,
  SuperAdminFeatures,
} from "./pages.js";
import ApplicationLayout from "../../components/layout/ApplicationLayout.jsx";

/**
 * Modèle de définition :
 * {
 *   key: string unique,
 *   path: string (URL sans rôle),
 *   component: page, | element: JSX (redirect),
 *   guard: 'user' | 'admin' | 'superAdmin' (sécurité, inchangé),
 *   access: { type } — déclaration d'accès pour la navigation (UX) :
 *     { type: 'public' } | { type: 'user' } |
 *     { type: 'permission', permission: <id>, capability?: 'USE' }
 *     Si absent → repli sur la logique guard.
 *   titleKey: clé i18n du titre (pages.<x>.title),
 *   navigation: { show, section, order, label, icon } (fondation sidebar),
 *   layout: layout des enfants, children: [route],
 * }
 */
export const routes = [
  {
    key: "home",
    path: "/",
    element: <Navigate to="/connexion" replace />,
    access: { type: "public" },
  },
  {
    key: "connexion",
    path: "/connexion",
    component: UserLogin,
    titleKey: "pages.connexion.title",
    access: { type: "public" },
  },
  {
    key: "inscription",
    path: "/inscription",
    component: Register,
    titleKey: "pages.inscription.title",
    access: { type: "public" },
  },
  {
    key: "motDePasseOublie",
    path: "/mot-de-passe-oublie",
    component: ForgotPassword,
    titleKey: "pages.motDePasseOublie.title",
    access: { type: "public" },
  },
  {
    key: "reinitialiserMotDePasse",
    path: "/reinitialiser-mot-de-passe",
    component: ResetPassword,
    titleKey: "pages.reinitialiserMotDePasse.title",
    access: { type: "public" },
  },
  {
    key: "loginAdmin",
    path: "/login",
    component: Login,
    titleKey: "pages.loginAdmin.title",
    access: { type: "public" },
  },
  {
    key: "test",
    path: "/test",
    component: TestApp,
    guard: "user",
    titleKey: "pages.test.title",
    navigation: { show: true, section: "administration", order: 90, label: "Passer le test", icon: Play },
    access: { type: "permission", permission: "assessment.take", capability: "USE" },
  },
  {
    key: "modifierMotDePasse",
    path: "/modifier-mot-de-passe",
    component: ChangePassword,
    guard: "user",
    titleKey: "pages.modifierMotDePasse.title",
    navigation: { show: true, section: "compte", order: 20, label: "Modifier le mot de passe", icon: Settings },
    access: { type: "user" },
  },
  {
    key: "compte",
    path: "/compte",
    component: Profile,
    guard: "user",
    titleKey: "pages.compte.title",
    navigation: { show: true, section: "compte", order: 10, label: "Mon compte", icon: User },
    access: { type: "user" },
  },
  {
    key: "resultats",
    path: "/admin",
    component: AdminResultats,
    guard: "admin",
    titleKey: "pages.resultats.title",
    navigation: { show: true, section: "administration", order: 20, label: "Résultats", icon: BarChart2 },
    access: { type: "permission", permission: "results.view" },
  },
  {
    key: "utilisateurs",
    path: "/admin/utilisateurs",
    component: AdminUsers,
    guard: "admin",
    titleKey: "pages.utilisateurs.title",
    navigation: { show: true, section: "administration", order: 30, label: "Utilisateurs", icon: Users },
    access: { type: "permission", permission: "users.view" },
  },
  {
    key: "modeTest",
    path: "/admin/mode-test/:id",
    component: ModeTest,
    guard: "admin",
    titleKey: "pages.modeTest.title",
    access: { type: "permission", permission: "results.view" },
  },
  {
    key: "superAdmin",
    layout: ApplicationLayout,
    guard: "superAdmin",
    children: [
      {
        key: "tableauDeBord",
        path: "/super-admin",
        guard: "superAdmin",
        component: SuperAdminDashboard,
        titleKey: "pages.tableauDeBord.title",
        navigation: { show: true, section: "administration", order: 10, label: "Vue d'ensemble", icon: LayoutDashboard },
      },
      {
        key: "comptes",
        path: "/super-admin/comptes",
        guard: "superAdmin",
        component: SuperAdminAccounts,
        titleKey: "pages.comptes.title",
        navigation: { show: true, section: "administration", order: 40, label: "Comptes", icon: Users },
      },
      {
        key: "roles",
        path: "/super-admin/roles",
        guard: "superAdmin",
        component: SuperAdminRoles,
        titleKey: "pages.roles.title",
        navigation: { show: true, section: "administration", order: 50, label: "Rôles", icon: Shield },
      },
      {
        key: "acces",
        path: "/super-admin/acces",
        guard: "superAdmin",
        component: SuperAdminAccess,
        titleKey: "pages.accessControl.title",
        navigation: { show: true, section: "administration", order: 60, label: "Accès", icon: Key },
        access: { type: "permission", permission: "rbac.role_permissions", capability: "MANAGE" },
      },
      {
        key: "pages",
        path: "/super-admin/pages",
        guard: "superAdmin",
        component: SuperAdminPages,
        titleKey: "pages.pages.title",
        navigation: { show: true, section: "administration", order: 70, label: "Pages", icon: FileText },
      },
      {
        key: "fonctionnalites",
        path: "/super-admin/fonctionnalites",
        guard: "superAdmin",
        component: SuperAdminFeatures,
        titleKey: "pages.fonctionnalites.title",
        navigation: { show: true, section: "administration", order: 80, label: "Fonctionnalités", icon: Settings },
      },
    ],
  },
  {
    key: "notFound",
    path: "*",
    element: <Navigate to="/connexion" replace />,
  },
];