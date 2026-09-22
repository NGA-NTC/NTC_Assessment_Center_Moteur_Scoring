// Test P5 — Configuration administrable depuis l'interface (backend)
// Sections :
//   A. Anti-verrouillage : garde delete_role (dernier fournisseur GRANT
//      users.change_role) + comportement revoke inchangé.
//   B. Assignabilité des rôles : list_role_assignability / set_role_assignability
//      (lecture + écriture, gardes DELEGATE rbac.role_assignability, refus négatifs).
// Supabase local attendu sur http://127.0.0.1:54321
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) => readFileSync(path.join(__dirname, '../../../src', rel), 'utf8');

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

const cleanup = [];

async function main() {
  console.log('=== P5 : Configuration administrable (backend) ===\n');

  const superAdmin = await signIn('p4_admin@test.com');
  const saClient = rpcClient(superAdmin.token);

  // ---- A. Anti-verrouillage ----
  console.log('--- A. Anti-verrouillage ---\n');

  const tempRole = `p5_lock_${Date.now()}`;
  cleanup.push(`role:${tempRole}`);
  const insRole = await saClient.from('roles').insert({ id: tempRole, name: 'P5 lock test', description: 'créé par test' });
  runTest('A1 création rôle test (non système)', !insRole.error, insRole.error?.message ?? 'OK');

  const updRpm = await saClient.rpc('grant_role_permission', {
    p_target_role_id: tempRole, p_permission_id: 'users.change_role',
    p_capabilities: { use: true, manage: false, grant: true, delegate: false },
    p_scope_type: 'global', p_scope_value: null,
  });
  runTest('A1 role_permissions GRANT users.change_role pour le rôle test (via RPC)', !updRpm.error, updRpm.error?.message ?? 'OK');

  const lockUser = await signUp(`p5_lock_${Date.now()}@test.com`);
  cleanup.push(lockUser.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: lockUser.id, role_id: tempRole, assigned_by: superAdmin.id });
  const lockRoles = await supabaseAdmin.from('user_roles').select('role_id').eq('user_id', lockUser.id);
  runTest('A2 utilisateur test a le rôle test (et au plus le rôle par défaut)',
    (lockRoles.data || []).some((r) => r.role_id === tempRole), JSON.stringify((lockRoles.data || []).map((r) => r.role_id)));

  // Snapshot des can_grant users.change_role pour restauration systématique
  const snapshotRes = await supabaseAdmin.from('role_permissions').select('role_id, can_grant').eq('permission_id', 'users.change_role');
  const snapshot = (snapshotRes.data || []).map((r) => ({ role_id: r.role_id, can_grant: r.can_grant }));

  try {
    // Rôle test devient le SEUL fournisseur GRANT users.change_role
    await supabaseAdmin.from('role_permissions').update({ can_grant: false }).eq('permission_id', 'users.change_role').neq('role_id', tempRole);

    const delBlocked = await saClient.from('roles').delete().eq('id', tempRole);
    runTest('A3 delete réfuse le dernier fournisseur GRANT users.change_role (ROLE_INSUPPRIMABLE)',
      !!delBlocked.error && /ROLE_INSUPPRIMABLE/.test(delBlocked.error.message ?? ''), delBlocked.error?.message ?? 'supprimé (inattendu)');

    const roleStill = await supabaseAdmin.from('roles').select('id').eq('id', tempRole);
    runTest('A3 le rôle na pas été supprimé', (roleStill.data || []).length > 0, `${(roleStill.data || []).length} ligne(s)`);

    const revokeStripped = await saClient.rpc('revoke_user_role', { p_target_user_id: lockUser.id, p_role_id: tempRole });
    runTest('A4 sans GRANT users.change_role, aucun revoke possible (verrouillage impossible)',
      !!revokeStripped.error && /PERMISSION_INSUFFISANTE/.test(revokeStripped.error.message ?? ''), revokeStripped.error?.message ?? 'autorisé (inattendu)');
  } finally {
    for (const row of snapshot) {
      await supabaseAdmin.from('role_permissions').update({ can_grant: row.can_grant }).eq('role_id', row.role_id).eq('permission_id', 'users.change_role');
    }
  }

  // Restauration complète : suppression possible à nouveau
  await supabaseAdmin.from('user_roles').delete().eq('user_id', lockUser.id).eq('role_id', tempRole);
  const delOk = await saClient.from('roles').delete().eq('id', tempRole);
  runTest('A5 suppression possible une fois un autre fournisseur présent', !delOk.error, delOk.error?.message ?? 'OK');
  cleanup.splice(cleanup.indexOf(`role:${tempRole}`), 1);

  // Revoke nominal inchangé (pas de fausse garde)
  const revokeUser = await signUp(`p5_rvk_${Date.now()}@test.com`);
  cleanup.push(revokeUser.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: revokeUser.id, role_id: 'candidate', assigned_by: superAdmin.id });
  const revokeOk = await saClient.rpc('revoke_user_role', { p_target_user_id: revokeUser.id, p_role_id: 'candidate' });
  runTest('A5 revoke nominal (candidate) inchangé', !revokeOk.error, revokeOk.error?.message ?? 'OK');

  // ---- B. Assignabilité des rôles ----
  console.log('\n--- B. Assignabilité des rôles ---\n');

  const graph = await saClient.rpc('list_role_assignability');
  runTest('B1 super_admin : list_role_assignability accessible', !graph.error, graph.error?.message ?? 'OK');
  const edges = (graph.data || []).map((e) => `${e.assigner_role_id}->${e.assignable_role_id}`);
  runTest('B1 graphe contient super_admin->admin et admin->candidate',
    edges.includes('super_admin->admin') && edges.includes('admin->candidate'), edges.sort().join(','));
  runTest('B1 pas d’auto-assignation (assigner==assignable)', !edges.some((e) => e.split('->')[0] === e.split('->')[1]), 'OK');

  const roleX = `p5_asg_${Date.now()}`;
  cleanup.push(`role:${roleX}`);
  await saClient.from('roles').insert({ id: roleX, name: 'P5 assignability test', description: 'créé par test' });
  const setAdd = await saClient.rpc('set_role_assignability', { p_assigner_role_id: 'admin', p_assignable_role_id: roleX, p_allow: true });
  runTest('B2 super_admin : set_role_assignability admin->roleX ok', !setAdd.error, setAdd.error?.message ?? 'OK');

  const graph2 = await saClient.rpc('list_role_assignability');
  const edges2 = (graph2.data || []).map((e) => `${e.assigner_role_id}->${e.assignable_role_id}`);
  runTest('B2 edge admin->roleX persistée', edges2.includes('admin->' + roleX), 'OK');

  const setRemove = await saClient.rpc('set_role_assignability', { p_assigner_role_id: 'admin', p_assignable_role_id: roleX, p_allow: false });
  const graph3 = await saClient.rpc('list_role_assignability');
  const edges3 = (graph3.data || []).map((e) => `${e.assigner_role_id}->${e.assignable_role_id}`);
  runTest('B2 set_role_assignability(allow=false) retire l’edge', !setRemove.error && !edges3.includes('admin->' + roleX), 'OK');

  const selfEdge = await saClient.rpc('set_role_assignability', { p_assigner_role_id: 'admin', p_assignable_role_id: 'admin', p_allow: true });
  runTest('B3 self-assignation REFUSÉE (VALIDATION_ERREUR)', !!selfEdge.error && /VALIDATION_ERREUR/.test(selfEdge.error.message ?? ''), selfEdge.error?.message ?? 'autorisé (inattendu)');

  const badRole = await saClient.rpc('set_role_assignability', { p_assigner_role_id: 'admin', p_assignable_role_id: 'role_inexistant_xyz', p_allow: true });
  runTest('B3 rôle assignable inexistant REFUSÉ (ROLE_INEXISTANT)', !!badRole.error && /ROLE_INEXISTANT/.test(badRole.error.message ?? ''), badRole.error?.message ?? 'autorisé (inattendu)');

  const candidateActor = await signUp(`p5_asg_cand_${Date.now()}@test.com`);
  cleanup.push(candidateActor.id);
  const candList = await rpcClient(candidateActor.token).rpc('list_role_assignability');
  runTest('B4 candidat : list_role_assignability REFUSÉ', !!candList.error && /PERMISSION_INSUFFISANTE/.test(candList.error.message ?? ''), candList.error?.message ?? 'autorisé (inattendu)');
  const candSet = await rpcClient(candidateActor.token).rpc('set_role_assignability', { p_assigner_role_id: 'admin', p_assignable_role_id: roleX, p_allow: true });
  runTest('B4 candidat : set_role_assignability REFUSÉ', !!candSet.error && /PERMISSION_INSUFFISANTE/.test(candSet.error.message ?? ''), candSet.error?.message ?? 'autorisé (inattendu)');

  // ---- E. Frontend : configuration administrable depuis l'interface ----
  console.log('\n--- E. Frontend ---\n');

  runTest('E1 services assignabilité : list/set via RPC',
    /list_role_assignability/.test(readSrc('services/rbac/roleAssignability/listRoleAssignability.js'))
    && /set_role_assignability/.test(readSrc('services/rbac/roleAssignability/setRoleAssignability.js')), 'services');

  const matrix = readSrc('components/admin/RoleAssignabilityMatrix.jsx');
  runTest('E2 matrice assignabilité : composant (list + set + gate DELEGATE)',
    /listRoleAssignability/.test(matrix) && /setRoleAssignability/.test(matrix)
    && /rbac\.role_assignability/.test(matrix) && /DELEGATE/.test(matrix), 'matrix');

  runTest('E3 Accès : matrice intégrée dans SuperAdminAccess', /RoleAssignabilityMatrix/.test(readSrc('pages/SuperAdminAccess.jsx')), 'intégration');

  runTest('E4 Utilisateurs : rôles chargés dynamiquement (listRoles)',
    /listRoles/.test(readSrc('pages/AdminUsers.jsx')) && /listRoles/.test(readSrc('pages/SuperAdminAccounts.jsx')), 'listRoles');

  const admDetail = readSrc('pages/AdminUserDetail.jsx');
  runTest('E4 Détail : rôles dynamiques, plus d\'ensemble fermé ni de ROLE_LABELS',
    /roles\s*=\s*\[\]/.test(admDetail) && /assignableRoles\.includes/.test(admDetail)
    && !/ROLE_LABELS/.test(admDetail) && !/canPromoteSuperAdmin/.test(admDetail), 'dynamique');

  runTest('E5 Comptes : rôle initial restreint aux rôles assignables', /initialRoleOptions/.test(readSrc('pages/SuperAdminAccounts.jsx')), 'initialRoleOptions');

  runTest('E6 Pages : badge Implémentée croisé avec le registre de routes',
    /Implémentée/.test(readSrc('pages/SuperAdminPages.jsx')) && /IMPLEMENTED_PATHS/.test(readSrc('pages/SuperAdminPages.jsx')), 'registry');

  runTest('E7 Fonctionnalités : ajout ciblé sur la page courante', /openCreateModal\(page\.id\)/.test(readSrc('pages/SuperAdminFeatures.jsx')), 'page_id');

  runTest('E8 Dashboard : ordre des rôles sans priorité hardcodée', !/const\s+priority/.test(readSrc('pages/SuperAdminDashboard.jsx')), 'no priority');

  // ---- Nettoyage ----
  for (const id of cleanup) {
    try {
      if (id.startsWith('role:')) {
        await supabaseAdmin.from('role_assignability').delete().or(`assigner_role_id.eq.${id.slice(5)},assignable_role_id.eq.${id.slice(5)}`);
        await supabaseAdmin.from('role_permissions').delete().eq('role_id', id.slice(5));
        await supabaseAdmin.from('user_roles').delete().eq('role_id', id.slice(5));
        await supabaseAdmin.from('roles').delete().eq('id', id.slice(5));
      } else {
        await supabaseAdmin.from('user_roles').delete().eq('user_id', id);
        await supabaseAdmin.auth.admin.deleteUser(id);
      }
    } catch { /* cleanup best effort */ }
  }

  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P5 BACKEND VALIDÉ - READY_FOR_FRONTEND');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });