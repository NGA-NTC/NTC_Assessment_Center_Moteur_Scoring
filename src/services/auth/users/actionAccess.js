// Contrat d'action frontend (gestion utilisateurs) — capacité effective requise par action.
// Le moteur reste unique : useEffectiveAuthority().can(permissionId, capability).
// Ce module ne fait que nommer les capacités requises (source unique pages + tests).
// Le backend (RLS/RPC) demeure la source de vérité : masquer une action ne l'autorise pas.

export const USER_ACTION_CONTRACT = {
  viewUsers: { permission: "users.view", capability: "USE" },
  editUser: { permission: "users.edit", capability: "USE" },
  createUser: { permission: "users.manage", capability: "USE" },
  changeRole: { permission: "users.change_role", capability: "GRANT" },
  resetPassword: { permission: "users.change_role", capability: "GRANT" },
  promoteAdmin: { permission: "users.promote_admin", capability: "GRANT" },
  promoteSuperAdmin: { permission: "users.promote_super_admin", capability: "GRANT" },
};

export function canViewUsers(can) {
  return can(USER_ACTION_CONTRACT.viewUsers.permission, USER_ACTION_CONTRACT.viewUsers.capability);
}

export function canEditUser(can) {
  return can(USER_ACTION_CONTRACT.editUser.permission, USER_ACTION_CONTRACT.editUser.capability);
}

export function canCreateUser(can) {
  return can(USER_ACTION_CONTRACT.createUser.permission, USER_ACTION_CONTRACT.createUser.capability);
}

export function canChangeRole(can) {
  return can(USER_ACTION_CONTRACT.changeRole.permission, USER_ACTION_CONTRACT.changeRole.capability);
}

export function canResetPassword(can) {
  return can(USER_ACTION_CONTRACT.resetPassword.permission, USER_ACTION_CONTRACT.resetPassword.capability);
}

export function canPromoteAdmin(can) {
  return can(USER_ACTION_CONTRACT.promoteAdmin.permission, USER_ACTION_CONTRACT.promoteAdmin.capability);
}

export function canPromoteSuperAdmin(can) {
  return can(USER_ACTION_CONTRACT.promoteSuperAdmin.permission, USER_ACTION_CONTRACT.promoteSuperAdmin.capability);
}

export const userActions = {
  canViewUsers,
  canEditUser,
  canCreateUser,
  canChangeRole,
  canResetPassword,
  canPromoteAdmin,
  canPromoteSuperAdmin,
};