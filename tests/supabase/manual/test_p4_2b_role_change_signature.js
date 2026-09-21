// Test ciblé P4.2b: Signature onRoleChange(user.id, roleId, add) alignée entre
// SuperAdminAccounts.handleRoleChange et AdminUserDetail
// Reproduit le comportement attendu depuis /super-admin/comptes :
//  - add=true  -> assign_user_role (ajout unitaire, préserve les autres rôles)
//  - add=false -> revoke_user_role (retrait unitaire, préserve les autres rôles)
// Backend = source de vérité (RPC assign_user_role / revoke_user_role inchangés).
// Supabase local attendu sur http://127.0.0.1:54321
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) => readFileSync(path.join(__dirname, '../../../src', rel), 'utf8');

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

async function assignRoleAs(token, target, role) {
  return rpcClient(token).rpc('assign_user_role', { p_target_user_id: target, p_role_id: role, p_expires_at: null });
}
async function revokeRoleAs(token, target, role) {
  return rpcClient(token).rpc('revoke_user_role', { p_target_user_id: target, p_role_id: role });
}
// Rôles ACTIFS uniquement (révocation = soft via revoked_at, pas de DELETE)
async function getActiveRoles(target) {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('role_id')
    .eq('user_id', target)
    .is('revoked_at', null)
    .or('expires_at.is.null,expires_at.gt.now');
  if (error) throw new Error(`user_roles: ${error.message}`);
  return (data || []).map((r) => r.role_id);
}

async function main() {
  console.log('=== P4.2b: Signature onRoleChange(user.id, roleId, add) ===\n');

  // ---- 1. Contrat source ----
  console.log('--- 1. Source : signature alignée entre les deux fichiers ---\n');

  const saa = readSrc('pages/SuperAdminAccounts.jsx');
  const admDetail = readSrc('pages/AdminUserDetail.jsx');

  runTest('1.1 AdminUserDetail appelle onRoleChange(user.id, roleId, add)',
    /onRoleChange\(user\.id,\s*roleId,\s*add\)/.test(admDetail), 'add = !roles.includes(roleId)');
  runTest('1.2 AdminUserDetail ne consomme pas (userId, newRoleId)',
    !/onRoleChange\(user\.id,\s*newRoleId\)/.test(admDetail), 'contrat unitaire');
  runTest('1.3 SuperAdminAccounts définit handleRoleChange(userId, roleId, add)',
    /handleRoleChange\s*=\s*async\s*\(userId,\s*roleId,\s*add\)/.test(saa), '(userId, roleId, add)');
  runTest('1.4 add=true -> assignRole (assign_user_role)',
    /if\s*\(add\)\s*\{[\s\S]*?await assignRole\(userId,\s*roleId\)/.test(saa), 'assignRole');
  runTest('1.5 add=false -> removeRole (revoke_user_role)',
    /else\s*\{[\s\S]*?await removeRole\(userId,\s*roleId\)/.test(saa), 'removeRole');
  runTest('1.6 plus de setUserRoles dans le handler SuperAdminAccounts',
    !/setUserRoles\(userId/.test(saa), 'retrait du remplacement entier du set');
  runTest('1.7 SuperAdminAccounts importe assignRole/removeRole',
    /import\s*\{[^}]*assignRole[^}]*removeRole[^}]*\}/.test(saa) &&
    !/setUserRoles[^,}]/.test(saa), 'services/rpc existants réutilisés');

  // ---- 2. Comportement corrigé (DB réelle) ----
  console.log('\n--- 2. Ajout + retrait unitaires depuis /super-admin/comptes (RPC réels) ---\n');

  const superAdmin = await signIn('p4_admin@test.com');
  const target = await signUp(`p4_2b_${Date.now()}@test.com`);
  const SUP = superAdmin.token;

  const rolesInitial = await getActiveRoles(target.id);
  runTest('2.1 cible initiale = [candidate]', rolesInitial.length === 1 && rolesInitial[0] === 'candidate', rolesInitial.join(','));

  // add=true: toggle admin ON (candidat + admin) — l\'ajout doit préserver les autres rôles
  const addAdmin = await assignRoleAs(SUP, target.id, 'admin');
  runTest('2.2 add admin autorisé (RPC sans erreur)', !addAdmin.error, addAdmin.error?.message ?? 'OK');
  const rolesAfterAdd = await getActiveRoles(target.id);
  runTest('2.3 add préserve les autres rôles -> [candidate, admin]',
    rolesAfterAdd.length === 2 && rolesAfterAdd.includes('candidate') && rolesAfterAdd.includes('admin'),
    rolesAfterAdd.sort().join(','));
  runTest('2.4 ajout idempotent (assign admin déjà présent) sans erreur', !(await assignRoleAs(SUP, target.id, 'admin')).error, 'OK');
  runTest('2.5 après assign idempotent -> toujours [candidate, admin]',
    (await getActiveRoles(target.id)).length === 2, (await getActiveRoles(target.id)).sort().join(','));

  // add=false: toggle candidate OFF -> retrait unitaire, admin préservé
  const removeCand = await revokeRoleAs(SUP, target.id, 'candidate');
  runTest('2.6 remove candidate autorisé (RPC sans erreur)', !removeCand.error, removeCand.error?.message ?? 'OK');
  const rolesAfterRemove = await getActiveRoles(target.id);
  runTest('2.7 remove préserve les autres rôles -> [admin]',
    rolesAfterRemove.length === 1 && rolesAfterRemove[0] === 'admin',
    rolesAfterRemove.join(','));

  // second retrait: remove admin -> aucun rôle actif
  const removeAdmin = await revokeRoleAs(SUP, target.id, 'admin');
  runTest('2.8 remove admin autorisé (RPC sans erreur)', !removeAdmin.error, removeAdmin.error?.message ?? 'OK');
  runTest('2.9 après remove admin -> aucun rôle actif', (await getActiveRoles(target.id)).length === 0, '0 actif');

  // retrait d\'un rôle absent -> le contrat backend lève ROLE_NON_ATTRIBUE (behaviour conservé)
  const removeNone = await revokeRoleAs(SUP, target.id, 'candidate');
  runTest('2.10 remove rôle absent refusé par back (ROLE_NON_ATTRIBUE)',
    !!removeNone.error && /ROLE_NON_ATTRIBUE/.test(removeNone.error?.message ?? ''),
    removeNone.error?.message ?? 'aucune erreur (inattendu)');

  // ---- 3. Contrainte RBAC conservée (role_assignability + promote_* pour admin) ----
  console.log('\n--- 3. Backend conserve les gardes RBAC (pas de changement de contrat) ---\n');

  // Acteur : rôle custom avec GRANT change_role + role_assignability candidate ET admin
  // -> peut assigner candidate (rôle ordinaire), mais PAS admin (promote_admin requis)
  const ROLE_ACT = `p4_2b_act_${Date.now()}`;
  await supabaseAdmin.from('roles').upsert({ id: ROLE_ACT, name: 'P4.2b act', description: 'change_role GRANT + assignability (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: ROLE_ACT, permission_id: 'users.change_role', can_use: true, can_manage: false, can_grant: true, can_delegate: false });
  const assignCandRow = await supabaseAdmin.from('role_assignability').upsert({ assigner_role_id: ROLE_ACT, assignable_role_id: 'candidate', created_by: superAdmin.id });
  const assignAdminRow = await supabaseAdmin.from('role_assignability').upsert({ assigner_role_id: ROLE_ACT, assignable_role_id: 'admin', created_by: superAdmin.id });
  runTest('3.0 role_assignability candidate/admin insérés avec created_by valide',
    !assignCandRow.error && !assignAdminRow.error,
    assignCandRow.error?.message ?? assignAdminRow.error?.message ?? 'OK');
  const actor = await signUp(`p4_2b_act_${Date.now()}@test.com`);
  await supabaseAdmin.from('user_roles').delete().eq('user_id', actor.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: actor.id, role_id: ROLE_ACT, assigned_by: actor.id });
  await supabaseAdmin.from('user_roles').delete().eq('user_id', target.id);

  const addCandidate = await assignRoleAs(actor.token, target.id, 'candidate');
  runTest('3.1 GRANT change_role + assignability -> assign candidate autorisé (rôle ordinaire)',
    !addCandidate.error, addCandidate.error?.message ?? 'OK');
  runTest('3.2 candidate bien actif côté cible', (await getActiveRoles(target.id)).includes('candidate'), 'candidate');
  const addAdminPriv = await assignRoleAs(actor.token, target.id, 'admin');
  runTest('3.3 GRANT change_role seul -> assign admin REFUSÉ (promote_admin requis)',
    !!addAdminPriv.error && /PROMOTION_INTERDITE/.test(addAdminPriv.error?.message ?? ''),
    addAdminPriv.error?.message ?? 'autorisé (inattendu)');
  runTest('3.4 admin NON actif côté cible après refus', !(await getActiveRoles(target.id)).includes('admin'), 'admin absent');

  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P4.2b VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });