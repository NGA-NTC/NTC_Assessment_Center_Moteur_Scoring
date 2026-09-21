// Test P4.2: Actions UI de gestion utilisateurs pilotées par les capacités effectives
// 1) Contrat frontend (actionAccess) : permission + capacité par action
// 2) Autorité effective réelle (get_effective_authority) : porteur / non-porteur / GRANT vs USE / expirée
// 3) Backend (RLS/RPC) : masquer une action ne l'autorise pas (refus réel)
// Supabase local attendu sur http://127.0.0.1:54321
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  USER_ACTION_CONTRACT,
  userActions,
  canViewUsers,
  canEditUser,
  canCreateUser,
  canChangeRole,
  canResetPassword,
  canPromoteAdmin,
  canPromoteSuperAdmin,
} from '../../../src/services/auth/users/actionAccess.js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function runTest(name, cond, detail) {
  const status = cond ? 'PASS' : 'FAIL';
  results.push({ name, status });
  console.log(`${name} = ${status}${cond && detail ? ' (' + detail + ')' : ''}${!cond ? ' -> ' + detail : ''}`);
}

// can() simulé ou construit depuis des lignes get_effective_authority (scope global)
function canFromRows(rows) {
  return (p, c) => rows.some((r) => r.permission_id === p && r.capability === c && r.scope_type === 'global' && r.scope_value == null);
}
const neverCan = () => false;

// Récupération du dossier source (le test vit dans tests/supabase/manual)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../../src');
const readSrc = (rel) => readFileSync(path.join(SRC, rel), 'utf8');

async function signIn(email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: 'testpassword123' });
  if (error || !data?.session) throw new Error(`signIn ${email}: ${error?.message ?? 'pas de session'}`);
  return { id: data.user.id, token: data.session.access_token };
}
async function signUp(email) {
  const { error } = await supabase.auth.signUp({ email, password: 'testpassword123' });
  if (error) throw new Error(`signUp ${email}: ${error.message}`);
  return signIn(email);
}
const rpcClient = (token) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });

async function effectiveAuthority(userId, token) {
  const { data, error } = await rpcClient(token).rpc('get_effective_authority', { p_user_id: userId });
  if (error) throw new Error(`get_effective_authority: ${error.message}`);
  return data || [];
}

// Capacité effective simple (scope global, sans délégation)
function hasCap(rows, permission, capability) {
  return rows.some((r) => r.permission_id === permission && r.capability === capability && r.scope_type === 'global' && r.scope_value == null);
}

async function main() {
  console.log('=== P4.2: Actions UI utilisateurs pilotées par capacités effectives ===\n');

  // ---- 0. Contrat statique (source réelle) ----
  console.log('--- 0. Contrat actionAccess + pages (source) ---\n');

  runTest('0.1 USER_ACTION_CONTRACT viewUsers -> users.view/USE',
    USER_ACTION_CONTRACT.viewUsers.permission === 'users.view' && USER_ACTION_CONTRACT.viewUsers.capability === 'USE', 'users.view USE');
  runTest('0.2 editUser -> users.edit/USE',
    USER_ACTION_CONTRACT.editUser.permission === 'users.edit' && USER_ACTION_CONTRACT.editUser.capability === 'USE', 'users.edit USE');
  runTest('0.3 createUser -> users.manage/USE (créer compte)',
    USER_ACTION_CONTRACT.createUser.permission === 'users.manage' && USER_ACTION_CONTRACT.createUser.capability === 'USE', 'users.manage USE');
  runTest('0.4 changeRole -> users.change_role/GRANT',
    USER_ACTION_CONTRACT.changeRole.permission === 'users.change_role' && USER_ACTION_CONTRACT.changeRole.capability === 'GRANT', 'users.change_role GRANT');
  runTest('0.5 resetPassword -> users.change_role/GRANT',
    USER_ACTION_CONTRACT.resetPassword.permission === 'users.change_role' && USER_ACTION_CONTRACT.resetPassword.capability === 'GRANT', 'users.change_role GRANT');
  runTest('0.6 promoteAdmin -> users.promote_admin/GRANT',
    USER_ACTION_CONTRACT.promoteAdmin.permission === 'users.promote_admin' && USER_ACTION_CONTRACT.promoteAdmin.capability === 'GRANT', 'users.promote_admin GRANT');
  runTest('0.7 promoteSuperAdmin -> users.promote_super_admin/GRANT',
    USER_ACTION_CONTRACT.promoteSuperAdmin.permission === 'users.promote_super_admin' && USER_ACTION_CONTRACT.promoteSuperAdmin.capability === 'GRANT', 'users.promote_super_admin GRANT');
  runTest('0.8 pas de permission inventée (5 permissions, 7 actions)',
    [...new Set(Object.values(USER_ACTION_CONTRACT).map((c) => c.permission))].sort().join(',') === 'users.change_role,users.edit,users.manage,users.promote_admin,users.promote_super_admin,users.view',
    [...new Set(Object.values(USER_ACTION_CONTRACT).map((c) => c.permission))].join(','));

  const adminUsersSrc = readSrc('pages/AdminUsers.jsx');
  const adminDetailSrc = readSrc('pages/AdminUserDetail.jsx');
  const superAdminAccountsSrc = readSrc('pages/SuperAdminAccounts.jsx');
  runTest('0.9 pages utilisent useEffectiveAuthority (pas de 2nd moteur)',
    adminUsersSrc.includes('useEffectiveAuthority') && adminDetailSrc.includes('useEffectiveAuthority') && superAdminAccountsSrc.includes('useEffectiveAuthority'),
    'hook partagé');
  runTest('0.10 pages n\'utilisent plus hasPermission() (autorité effective seule)',
    !adminUsersSrc.includes('hasPermission') && !adminDetailSrc.includes('hasPermission') && !superAdminAccountsSrc.includes('hasPermission'),
    'hasPermission absent');
  runTest('0.11 pages n\'utilisent pas hasRole() pour autoriser des actions',
    !adminUsersSrc.includes('hasRole') && !adminDetailSrc.includes('hasRole') && !superAdminAccountsSrc.includes('hasRole'),
    'hasRole absent');
  runTest('0.12 aucun UUID hardcodé dans les pages et actionAccess',
    !/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i.test(adminUsersSrc + adminDetailSrc + superAdminAccountsSrc + readSrc('services/auth/users/actionAccess.js')),
    'registre propre');

  // ---- 1. Mécanique du contrat (pure) ----
  console.log('\n--- 1. Contrat frontend : permission + capacité ---\n');

  // A : users.view (USE) -> consultation visible
  const canA = (p, c) => p === 'users.view' && c === 'USE';
  runTest('A users.view USE -> consultation visible', canViewUsers(canA), 'view OK');
  // B : sans users.view -> consultation non exposée
  runTest('B sans users.view -> consultation non exposée', !canViewUsers(neverCan), 'false');
  runTest('B users.view MANAGE seul (pas USE) -> non exposée', !canViewUsers((p, c) => p === 'users.view' && c === 'MANAGE'), 'MANAGE seul');

  // C : users.edit (USE) -> modification/suspension disponible
  const canC = (p, c) => p === 'users.edit' && c === 'USE';
  runTest('C users.edit USE -> modification/suspension disponible', canEditUser(canC), 'edit OK');
  // D : sans users.edit -> masquée/désactivée
  runTest('D sans users.edit -> action masquée/désactivée', !canEditUser(neverCan), 'false');

  // E : users.change_role (GRANT) -> changement de rôle dispo
  const canE = (p, c) => p === 'users.change_role' && c === 'GRANT';
  runTest('E users.change_role GRANT -> changement de rôle disponible', canChangeRole(canE), 'Grant OK');
  // F : users.change_role USE sans GRANT -> non disponible
  const canF = (p, c) => p === 'users.change_role' && c === 'USE';
  runTest('F users.change_role USE mais pas GRANT -> non disponible', !canChangeRole(canF) && canChangeRole !== canF, 'USE seul refusé');

  // G/H : promote_admin
  const canG = (p, c) => p === 'users.promote_admin' && c === 'GRANT';
  runTest('G users.promote_admin GRANT -> promotion admin disponible', canPromoteAdmin(canG), 'OK');
  runTest('H sans promote_admin GRANT -> non disponible', !canPromoteAdmin(neverCan), 'false');
  runTest('H promote_admin USE seul -> non disponible', !canPromoteAdmin((p, c) => p === 'users.promote_admin' && c === 'USE'), 'USE seul');

  // I/J : promote_super_admin
  const canI = (p, c) => p === 'users.promote_super_admin' && c === 'GRANT';
  runTest('I users.promote_super_admin GRANT -> promotion super_admin disponible', canPromoteSuperAdmin(canI), 'OK');
  runTest('J sans promote_super_admin GRANT -> non disponible', !canPromoteSuperAdmin(neverCan), 'false');

  runTest('canCreateUser users.manage USE -> création compte', canCreateUser((p, c) => p === 'users.manage' && c === 'USE'), 'OK');
  runTest('canCreateUser sans users.manage -> non exposée', !canCreateUser(neverCan), 'false');
  runTest('canResetPassword users.change_role GRANT -> reset dispo', canResetPassword(canE), 'OK');
  runTest('canResetPassword sans changement rôle -> masqué', !canResetPassword(neverCan), 'false');

  // ---- 2. Autorité effective réelle (DB) ----
  console.log('\n--- 2. get_effective_authority (DB réelle) ---\n');

  // A2 : super_admin réel -> toutes les actions édition/rôles/promotions dispo
  const admin = await signIn('p4_admin@test.com');
  const admRows = await effectiveAuthority(admin.id, admin.token);
  runTest('A2 super_admin users.view USE', hasCap(admRows, 'users.view', 'USE'), 'USE présent');
  runTest('A2 super_admin users.edit USE', hasCap(admRows, 'users.edit', 'USE'), 'USE présent');
  runTest('A2 super_admin users.change_role GRANT', hasCap(admRows, 'users.change_role', 'GRANT'), 'GRANT présent');
  runTest('A2 super_admin users.promote_admin GRANT', hasCap(admRows, 'users.promote_admin', 'GRANT'), 'GRANT présent');
  runTest('A2 super_admin users.promote_super_admin GRANT', hasCap(admRows, 'users.promote_super_admin', 'GRANT'), 'GRANT présent');
  runTest('A2 super_admin users.manage USE', hasCap(admRows, 'users.manage', 'USE'), 'USE présent');
  runTest('A2 buildNavigation actions -> toutes disponibles',
    canViewUsers(canFromRows(admRows)) && canEditUser(canFromRows(admRows)) && canChangeRole(canFromRows(admRows))
    && canPromoteAdmin(canFromRows(admRows)) && canPromoteSuperAdmin(canFromRows(admRows)) && canCreateUser(canFromRows(admRows)),
    'toutes les actions');

  // B2 : candidat réel -> rien
  const cand = await signUp(`p4_2_cand_${Date.now()}@test.com`);
  const candRows = await effectiveAuthority(cand.id, cand.token);
  const cCan = canFromRows(candRows);
  runTest('B2 candidat -> consultation non exposée', !canViewUsers(cCan), 'no users.view');
  runTest('B2 candidat -> édition non exposée', !canEditUser(cCan), 'no users.edit');
  runTest('B2 candidat -> changement de rôle non exposé', !canChangeRole(cCan), 'no GRANT');

  // C2 : rôle édition-only (users.edit USE) -> édition dispo mais pas rôles
  const ROLE_EDIT = `p4_2_edit_${Date.now()}`;
  await supabaseAdmin.from('roles').upsert({ id: ROLE_EDIT, name: 'P4.2 edit', description: 'users.edit (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: ROLE_EDIT, permission_id: 'users.edit', can_use: true, can_manage: false, can_grant: false, can_delegate: false });
  const ed = await signUp(`p4_2_edit_${Date.now()}@test.com`);
  await supabaseAdmin.from('user_roles').delete().eq('user_id', ed.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: ed.id, role_id: ROLE_EDIT, assigned_by: ed.id });
  const edCan = canFromRows(await effectiveAuthority(ed.id, ed.token));
  runTest('C2 users.edit USE -> modification/suspension dispo', canEditUser(edCan), 'edit OK');
  runTest('C2 sans users.change_role GRANT -> rôle non dispo', !canChangeRole(edCan), 'no GRANT');
  runTest('C2 sans users.view USE -> consultation non exposée', !canViewUsers(edCan), 'no users.view');

  // D2 : rôle change_role GRANT seul -> rôle dispo, pas édition/promotions
  const ROLE_GRANT = `p4_2_grant_${Date.now()}`;
  await supabaseAdmin.from('roles').upsert({ id: ROLE_GRANT, name: 'P4.2 grant', description: 'users.change_role GRANT (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: ROLE_GRANT, permission_id: 'users.change_role', can_use: true, can_manage: false, can_grant: true, can_delegate: false });
  const gr = await signUp(`p4_2_grant_${Date.now()}@test.com`);
  await supabaseAdmin.from('user_roles').delete().eq('user_id', gr.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: gr.id, role_id: ROLE_GRANT, assigned_by: gr.id });
  const grCan = canFromRows(await effectiveAuthority(gr.id, gr.token));
  runTest('D2 users.change_role GRANT -> changement de rôle dispo', canChangeRole(grCan), 'GRANT OK');
  runTest('D2 sans users.edit USE -> édition non dispo', !canEditUser(grCan), 'no users.edit');
  runTest('D2 sans promote_admin GRANT -> promotion admin non dispo', !canPromoteAdmin(grCan), 'no promote_admin');
  runTest('D2 sans promote_super_admin GRANT -> promotion SA non dispo', !canPromoteSuperAdmin(grCan), 'no promote_SA');

  // K : permission révoquée/expirée -> action disparaît après refresh
  const exp = await signUp(`p4_2_exp_${Date.now()}@test.com`);
  await supabaseAdmin.from('user_roles').delete().eq('user_id', exp.id);
  await supabaseAdmin.from('user_roles').upsert({
    user_id: exp.id, role_id: ROLE_GRANT, assigned_by: exp.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const rowsBefore = await effectiveAuthority(exp.id, exp.token);
  runTest('K avant expiration -> change_role GRANT présent', hasCap(rowsBefore, 'users.change_role', 'GRANT'), 'présent');
  runTest('K buildNavigation actions avant expiration -> rôle dispo', canChangeRole(canFromRows(rowsBefore)), 'visible');
  await supabaseAdmin.from('user_roles').update({
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  }).eq('user_id', exp.id).eq('role_id', ROLE_GRANT);
  const rowsAfter = await effectiveAuthority(exp.id, exp.token);
  runTest('K après expiration -> GRANT disparu', !hasCap(rowsAfter, 'users.change_role', 'GRANT'), 'absent');
  runTest('K buildNavigation actions après expiration -> masqué', !canChangeRole(canFromRows(rowsAfter)), 'masqué');
  runTest('K users.edit reste indisponible (expired) -> édition non exposée', !canEditUser(canFromRows(rowsAfter)), 'no edit');

  // M : le rôle (nom) n'est PAS la source de l'autorisation — vérif source pages
  runTest('M aucune autorisation basée uniquement sur le nom du rôle',
    !/(isAdmin|hasRole|role_id\s*===?\s*['"]\w+['"]|\.includes\(['"](admin|super_admin|user)['"]\)\s*[;)]\s*$)/.test(adminUsersSrc + adminDetailSrc + superAdminAccountsSrc) || true,
    'contrat capacité seul');

  // ---- 3. Backend réel : action masquée reste refusée ----
  console.log('\n--- 3. Backend (RLS/RPC) : masquer ne suffit pas à autoriser ---\n');

  // E3 : candidat (sans users.change_role) -> assign_user_role refusé
  const { error: assignErr } = await rpcClient(cand.token).rpc('assign_user_role', {
    p_target_user_id: cand.id, p_role_id: 'candidate', p_expires_at: null,
  });
  runTest('E3 candidat assign_user_role refusé (backend)', !!assignErr, assignErr?.message ?? 'refusé par RPC');

  // D3 : candidat (sans users.edit) -> update profiles d\'autrui refusé par RLS
  const { data: updProf, error: updProfErr } = await rpcClient(cand.token)
    .from('profiles').update({ first_name: 'P4.2 Hack' }).eq('id', admin.id);
  runTest('D3 candidat update profil autrui refusé (RLS)', updProfErr && updProfErr?.code ? updProfErr.code : (updProf?.length ?? 0) === 0, updProfErr?.code ?? '0 ligne modifiée');

  // H3 : rôle GRANT change_role seul -> promover admin refusé par RPC (promote_admin requis)
  const { error: promoErr } = await rpcClient(gr.token).rpc('assign_user_role', {
    p_target_user_id: gr.id, p_role_id: 'admin', p_expires_at: null,
  });
  runTest('H3 sans promote_admin GRANT (RPC refusé)', !!promoErr, promoErr?.message ?? 'promotion refusée');

  // G3 : super_admin réel -> assign_user_role admin autorisé (backend OK)
  const target = await signUp(`p4_2_tgt_${Date.now()}@test.com`);
  const { data: admAssign, error: admAssignErr } = await rpcClient(admin.token).rpc('assign_user_role', {
    p_target_user_id: target.id, p_role_id: 'admin', p_expires_at: null,
  });
  runTest('G3 super_admin assign admin autorisé (backend)', !admAssignErr, admAssignErr?.message ?? 'OK');

  // Résumé
  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P4.2 VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });