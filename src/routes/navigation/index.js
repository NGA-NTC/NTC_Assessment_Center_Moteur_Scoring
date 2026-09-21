export const NAVIGATION_SECTION_LABELS = {
  administration: "NAVIGATION",
  compte: "COMPTE",
};

export const NAVIGATION_SECTION_SUBTITLES = {
  administration: "Administration",
  compte: "Compte",
};

export function getRouteByKey(routeList, key) {
  return flattenRoutes(routeList).find((route) => route.key === key) ?? null;
}

export function getRouteByPath(routeList, pathname) {
  return flattenRoutes(routeList).find((route) => matchesPath(route.path, pathname)) ?? null;
}

/**
 * Construit la navigation UX à partir des métadonnées du registry.
 * Couche d'affichage uniquement : la protection reste assurée par les guards.
 */
export function buildNavigation(routeList, access) {
  const items = [];

  const walk = (routes) => {
    for (const route of routes) {
      if (route.navigation?.show && route.path && isAccessible(route, access)) {
        items.push({
          key: route.key,
          label: route.navigation.label ?? "",
          icon: route.navigation.icon ?? null,
          path: route.path,
          section: route.navigation.section ?? "navigation",
          order: route.navigation.order ?? 0,
        });
      }
      if (route.children) walk(route.children);
    }
  };

  walk(routeList);

  items.sort(
    (a, b) =>
      a.section === b.section ? a.order - b.order : a.section.localeCompare(b.section)
  );

  return items;
}

function isAccessible(route, access) {
  if (route.access) {
    const decision = resolveAccess(route.access, access);
    if (decision !== null) return decision;
  }

  return guardAllows(route, access);
}

/**
 * Évalue la déclaration `access` du registry (contrat P3).
 * Retourne un booléen, ou `null` quand la déclaration ne peut pas être
 * résolue (type inconnu / contexte absent) → repli sur la logique guard.
 * L'autorité évaluée ici est transitoire (permissions de UserAuthContext) ;
 * l'intégration des RPC d'autorité effective ne change pas cette signature.
 */
function resolveAccess(requirement, access) {
  switch (requirement.type) {
    case "public":
      return true;
    case "user":
      return !!access.user;
    case "permission": {
      if (typeof access.canPermission !== "function") return null;
      const capability = requirement.capability ?? "USE";
      return access.canPermission(requirement.permission, capability);
    }
    default:
      return null;
  }
}

function guardAllows(route, access) {
  if (!route.guard) return true;

  const checks = {
    user: (ctx) => !!ctx.user,
    admin: (ctx) => ctx.isAdmin,
    superAdmin: (ctx) => ctx.hasRole("super_admin"),
  };

  const check = checks[route.guard];
  return check ? check(access) : true;
}

/**
 * Sélectionne l'élément de navigation correspondant au chemin actif.
 * Correspondance exacte ou parcours descendant le plus profond.
 */
export function findNavMatch(items, pathname) {
  const matches = items.filter(
    (item) =>
      pathname === item.path ||
      (item.path.length > 1 && pathname.startsWith(item.path + "/"))
  );
  if (matches.length === 0) return null;
  return matches.reduce((longest, item) =>
    item.path.length > longest.path.length ? item : longest
  );
}

function flattenRoutes(routeList) {
  return routeList.reduce((acc, route) => {
    acc.push(route);
    if (route.children) {
      acc.push(...flattenRoutes(route.children));
    }
    return acc;
  }, []);
}

function matchesPath(pattern, pathname) {
  if (!pattern) return false;

  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every(
    (segment, index) => segment.startsWith(":") || segment === pathSegments[index]
  );
}