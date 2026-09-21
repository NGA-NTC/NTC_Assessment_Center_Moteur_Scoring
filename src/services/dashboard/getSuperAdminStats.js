import { listUsers } from "../auth/users/index.js";
import { listRoles } from "../rbac/roles/index.js";
import { listPages } from "../pages/index.js";
import { listFeatures } from "../features/index.js";
import { listRolePermissions } from "../rbac/rolePermissions/index.js";

export async function getSuperAdminStats() {
  const [users, roles, pages, featuresBundle, rp] = await Promise.all([
    listUsers(),
    listRoles(),
    listPages(),
    listFeatures(),
    listRolePermissions(),
  ]);

  const features = featuresBundle?.features ?? [];

  const recentUsers = users
    .filter((u) => u.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return {
    totals: {
      users: users.length,
      roles: roles.length,
      pages: pages.length,
      features: features.length,
      access: rp.length,
    },
    recentUsers,
  };
}