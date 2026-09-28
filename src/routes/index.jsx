import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserAuthProvider } from "../context/UserAuthProvider.jsx";
import { AdminAuthProvider } from "../context/AdminAuthContext.jsx";
import { routes } from "./registry/index.jsx";
import { ROUTE_GUARDS } from "./guards/index.js";
import DocumentTitleSync from "./DocumentTitleSync.jsx";
import { LoadingState } from "../components/ui/States.jsx";

// Code splitting : les pages du registre sont des composants lazy.
// Le fallback s'affiche sous le guard (aucun accès dévoilé pendant le chargement),
// utilise les tokens light/dark et évite tout écran blanc.
function LazyPage({ component: Page }) {
  return (
    <Suspense fallback={<LoadingState minHeight={480} />}>
      <Page />
    </Suspense>
  );
}

function withGuard(route, node) {
  const Guard = ROUTE_GUARDS[route.guard];
  return Guard ? <Guard>{node}</Guard> : node;
}

function renderLeaf(route) {
  if (route.element) {
    return <Route key={route.key} path={route.path} element={route.element} />;
  }
  return <Route key={route.key} path={route.path} element={withGuard(route, <LazyPage component={route.component} />)} />;
}

function renderRoute(route, allRoutes) {
  if (route.children) {
    const Layout = route.layout;
    return (
      <Route key={route.key} element={withGuard(route, <Layout routes={allRoutes} />)}>
        {route.children.map((child) => renderLeaf(child))}
      </Route>
    );
  }
  return renderLeaf(route);
}

export default function AppRoutes() {
  return (
    <UserAuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <DocumentTitleSync />
          <Routes>{routes.map((route) => renderRoute(route, routes))}</Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </UserAuthProvider>
  );
}