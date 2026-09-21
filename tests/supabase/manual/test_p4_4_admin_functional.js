// Test P4.4 — Administration fonctionnelle & interface commune
// Vérifie les corrections : comptes (user_id/auth_created_at normalisés), rôles
// (is_assignable + parent_id + protection rôles système), accès (4 capacités
// indépendantes USE/MANAGE/GRANT/DELEGATE + anti-escalade), pages/fonctionnalités
// (RLS), sidebars communes, /compte (profile.view/profile.edit), et absence de
// reset-password / édition perso dans les écrans d'administration.
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

const cleanup = [];
async function main() {
  console.log('=== P4.4 : Administration fonctionnelle & interface commune ===\n');

  const superAdmin = await signIn('p4_admin@test.com');
  const SUP = superAdmin.token;
  const saClient = rpcClient(SUP);

  // ---- A. Comptes : liste normalisée + rôles assignables ----
  console.log('--- A. Comptes ---\n');

  const assignSuper = await saClient.rpc('list_assignable_roles');
  const superRoleIds = (assignSuper.data || []).map((r) => r.assignable_role_id);
  runTest('A1 super_admin : list_assignable_roles accessible', !assignSuper.error, assignSuper.error?.message ?? 'OK');
  runTest('A1 super_admin : roles assignables = [admin, candidate]',
    superRoleIds.includes('admin') && superRoleIds.includes('candidate'), superRoleIds.sort().join(','));
  runTest('A1 super_admin : pas de self-assignation (super_admin absent)', !superRoleIds.includes('super_admin'), superRoleIds.join(','));

  // acteur admin (rôle admin) : edges admin -> candidate + super_admin
  const adminActor = await signUp(`p4_4_admin_${Date.now()}@test.com`);
  cleanup.push(adminActor.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: adminActor.id, role_id: 'admin', assigned_by: superAdmin.id });
  const assignAdmin = await rpcClient(adminActor.token).rpc('list_assignable_roles');
  const adminRoleIds = (assignAdmin.data || []).map((r) => r.assignable_role_id);
  runTest('A1 admin (acteur) : list_assignable_roles accessible', !assignAdmin.error, assignAdmin.error?.message ?? 'OK');
  runTest('A1 admin (acteur) : contient candidate et super_admin (edge admin->*)',
    adminRoleIds.includes('candidate') && adminRoleIds.includes('super_admin'), adminRoleIds.sort().join(','));

  const candidateActor = await signUp(`p4_4_cand_${Date.now()}@test.com`);
  cleanup.push(candidateActor.id);
  const assignCand = await rpcClient(candidateActor.token).rpc('list_assignable_roles');
  runTest('A1 candidat : aucune edge -> liste vide (sans erreur)',
    !assignCand.error && (assignCand.data || []).length === 0, assignCand.error?.message ?? `${(assignCand.data||[]).length} rôle(s)`);

  // contrat admin_get_users : clés user_id + auth_created_at
  const adminRows = await saClient.rpc('admin_get_users');
  const rows = adminRows.data || [];
  runTest('A2 admin_get_users : rows retournées', !adminRows.error && rows.length > 0, `${rows.length} users`);
  runTest('A2 admin_get_users : user_id présent sur toutes les lignes', rows.every((r) => r.user_id), 'user_id');
  const withAuthCreated = rows.filter((r) => r.auth_created_at).length;
  runTest('A2 admin_get_users : auth_created_at présent (source created_at frontend)', withAuthCreated === rows.length, `${withAuthCreated}/${rows.length}`);

  const saa = readSrc('pages/SuperAdminAccounts.jsx');
  runTest('A3 Comptes : plus de resetPassword', !/resetPassword/.test(saa), 'import et handler retirés');
  runTest('A3 Comptes : plus de updateUserProfile', !/updateUserProfile/.test(saa), 'édition perso retirée');
  runTest('A3 Comptes : création sans super_admin (option candidate/admin, pas de canal de promotion SA)',
    !/canPromoteSuperAdmin/.test(saa) && /Rôle initial/.test(saa), 'candidate/admin uniquement');
  runTest('A4 Comptes : normalisation user_id -> id', /user_id:\s*row\.user_id/.test(readSrc('services/auth/users/listUsers.js')), 'listUsers.map');
  runTest('A4 Comptes : auth_created_at -> created_at', /created_at:\s*row\.auth_created_at/.test(readSrc('services/auth/users/listUsers.js')), 'listUsers.default');

  // ---- B. Rôles : is_assignable + parent_id + is_system ----
  console.log('\n--- B. Rôles ---\n');

  const tempRole = `p4_4_role_${Date.now()}`;
  cleanup.push(`role:${tempRole}`);
  const insRole = await saClient.from('roles').insert({ id: tempRole, name: 'P4.4 rôle test', description: 'créé par test', is_assignable: true, parent_id: 'admin' });
  runTest('B1 super_admin : création rôle is_assignable + parent_id ok', !insRole.error, insRole.error?.message ?? 'OK');
  const roleRow = await saClient.from('roles').select('is_assignable, parent_id').eq('id', tempRole).single();
  runTest('B2 rôle créé : is_assignable + parent_id persistés',
    roleRow.data?.is_assignable === true && roleRow.data?.parent_id === 'admin', JSON.stringify(roleRow.data));
  const updRole = await saClient.from('roles').update({ is_assignable: false, parent_id: null }).eq('id', tempRole);
  runTest('B3 rôle mis à jour : is_assignable=false + parent_id=null persistés', !updRole.error, updRole.error?.message ?? 'OK');
  const roleRow2 = await saClient.from('roles').select('is_assignable, parent_id').eq('id', tempRole).single();
  runTest('B3b lecture après update', roleRow2.data?.is_assignable === false && roleRow2.data?.parent_id === null, JSON.stringify(roleRow2.data));
  const insCandRole = await rpcClient(candidateActor.token).from('roles').insert({ id: `p4_4_ral_${Date.now()}`, name: 'rôle refusé' });
  runTest('B4 candidat : création rôle REFUSÉ (RLS roles_manage_super_admin)', !!insCandRole.error, insCandRole.error?.message ?? 'autorisé (inattendu)');
  const delRole = await saClient.from('roles').delete().eq('id', tempRole);
  runTest('B5 super_admin : suppression rôle custom ok', !delRole.error, delRole.error?.message ?? 'OK');

  const sr = readSrc('pages/SuperAdminRoles.jsx');
  const delSvc = readSrc('services/rbac/roles/deleteRole.js');
  runTest('B6 Rôles : protection basée sur is_system (plus de id hardcodé super_admin)',
    !/role\.id\s*===\s*["']super_admin["']/.test(sr) && /isSystemRole/.test(sr), 'is_system');
  runTest('B6 Rôles : service deleteRole refuse les rôles système',
    /is_system/.test(delSvc) && /ROLE_SYSTEME_INSUPPRIMABLE/.test(delSvc), 'ROLE_SYSTEME_INSUPPRIMABLE');

  // ---- C. Accès : 4 capacités indépendantes + anti-escalade + négatifs ----
  console.log('\n--- C. Accès ---\n');

  const permAcc = tempRole + '_acc';
  cleanup.push(`role:${permAcc}`);
  await saClient.from('roles').insert({ id: permAcc, name: 'P4.4 accès test', description: 'généré par test' });
  // permission sur laquelle super_admin dispose de GRANT (acteur = décideur d'accès)
  const grant = await saClient.rpc('grant_role_permission', {
    p_target_role_id: permAcc, p_permission_id: 'rbac.role_permissions',
    p_capabilities: { use: true, manage: false, grant: true, delegate: false },
    p_scope_type: 'global', p_scope_value: null,
  });
  runTest('C1 GRANT indépendance : use+grant sans manage+delegate', !grant.error, grant.error?.message ?? 'OK');
  const rpRow = await saClient.from('role_permissions').select('permission_id, can_use, can_manage, can_grant, can_delegate').eq('role_id', permAcc).eq('permission_id', 'rbac.role_permissions').single();
  runTest('C1b capacités indépendantes (t/f/t/f)',
    rpRow.data?.can_use === true && rpRow.data?.can_manage === false && rpRow.data?.can_grant === true && rpRow.data?.can_delegate === false,
    `${rpRow.data?.can_use}/${rpRow.data?.can_manage}/${rpRow.data?.can_grant}/${rpRow.data?.can_delegate}`);
  const revManage = await saClient.rpc('revoke_role_permission', {
    p_target_role_id: permAcc, p_permission_id: 'rbac.role_permissions', p_capabilities: ['MANAGE'], p_scope_type: 'global', p_scope_value: null,
  });
  const rpRow2 = await saClient.from('role_permissions').select('can_use, can_manage, can_grant, can_delegate').eq('role_id', permAcc).eq('permission_id', 'rbac.role_permissions').single();
  runTest('C2 revoke MANAGE : autres capacités préservées',
    !revManage.error && rpRow2.data?.can_use === true && rpRow2.data?.can_grant === true, revManage.error?.message ?? 'préservé');
  const revGrant = await saClient.rpc('revoke_role_permission', {
    p_target_role_id: permAcc, p_permission_id: 'rbac.role_permissions', p_capabilities: ['GRANT'], p_scope_type: 'global', p_scope_value: null,
  });
  const rpRow3 = await saClient.from('role_permissions').select('can_use, can_manage, can_grant, can_delegate').eq('role_id', permAcc).eq('permission_id', 'rbac.role_permissions').single();
  runTest('C2b revoke GRANT : use conservé', !revGrant.error && rpRow3.data?.can_use === true && rpRow3.data?.can_grant === false, 'use=true grant=false');
  await saClient.from('role_permissions').delete().eq('role_id', permAcc);

  const antiEsc = await saClient.rpc('grant_role_permission', {
    p_target_role_id: 'super_admin', p_permission_id: 'rbac.role_permissions',
    p_capabilities: { use: false, manage: false, grant: true, delegate: false },
    p_scope_type: 'global', p_scope_value: null,
  });
  runTest('C3 anti-escalade : GRANT sur rbac.* pour son propre rôle super_admin REFUSÉ',
    !!antiEsc.error, antiEsc.error?.message ?? 'autorisé (inattendu)');

  const candGrant = await rpcClient(candidateActor.token).rpc('grant_role_permission', {
    p_target_role_id: permAcc, p_permission_id: 'results.view',
    p_capabilities: { use: true, manage: false, grant: false, delegate: false },
    p_scope_type: 'global', p_scope_value: null,
  });
  runTest('C4 négatif : candidat grant_role_permission REFUSÉ', !!candGrant.error, candGrant.error?.message ?? 'autorisé (inattendu)');

  const uac = readSrc('hooks/rbac/useAccessControl.js');
  const accUi = readSrc('pages/SuperAdminAccess.jsx');
  runTest('C5 Accès : matrice 4 capacités (use/manage/grant/delegate)', /use:\s*false, manage:\s*false, grant:\s*false, delegate:\s*false/.test(uac) && /toggleCapability/.test(uac) && /can_grant/.test(uac), '4 capacités');
  runTest('C5 Accès : UI colonnes GRANT et DELEGATE', /GRANT/.test(accUi) && /DELEGATE/.test(accUi), 'colonnes');
  runTest('C5 Accès : verrou UI rbac.* pour super_admin', /startsWith\("rbac\."\)/.test(accUi), 'anti-escalade côté UI');

  // ---- D. Pages & Fonctionnalités : RLS ----
  console.log('\n--- D. Pages & Fonctionnalités ---\n');

  const candFeatures = await rpcClient(candidateActor.token).from('features').select('id').limit(1);
  const candPages = await rpcClient(candidateActor.token).from('pages').select('id').limit(1);
  runTest('D1 candidat : lecture features/pages autorisée (select_all)', !candFeatures.error && !candPages.error, 'lecture ok');
  const tempFeat = `p4_4_feat_${Date.now()}`;
  const firstPage = await saClient.from('pages').select('id').limit(1).single();
  const candInsFeat = await rpcClient(candidateActor.token).from('features').insert({ id: tempFeat, name: 'f interdite', page_id: firstPage.data?.id, description: '' });
  runTest('D2 candidat : insertion feature REFUSÉE (RLS)', !!candInsFeat.error && /row-level security/.test(candInsFeat.error?.message ?? ''), candInsFeat.error?.message ?? 'autorisé (inattendu)');
  const saInsFeat = await saClient.from('features').insert({ id: tempFeat, name: 'P4.4 feature test', page_id: firstPage.data?.id, description: 'créé par test' });
  runTest('D3 super_admin : création feature ok', !saInsFeat.error, saInsFeat.error?.message ?? 'OK');
  const delFeat = await saClient.from('features').delete().eq('id', tempFeat);
  runTest('D4 super_admin : suppression feature ok', !delFeat.error, delFeat.error?.message ?? 'OK');

  // ---- E. Dashboard ----
  console.log('\n--- E. Dashboard ---\n');

  const stats = readSrc('services/dashboard/getSuperAdminStats.js');
  runTest('E1 dashboard : features comptées via listFeatures().features',
    /featuresBundle\?\.features/.test(stats) && /features: features\.length/.test(stats), 'features.length corrigé');
  runTest('E1 dashboard : recentUsers basé sur created_at normalisé',
    /u\.created_at/.test(stats), 'recentUsers/created_at');
  const featCount = await saClient.from('features').select('id', { count: 'exact', head: true });
  runTest('E2 dashboard : compteur features > 0 (cohérent avec liste)', (featCount.count ?? 0) > 0, `${featCount.count} features`);

  // ---- F. Sidebars communes ----
  console.log('\n--- F. Sidebars communes ---\n');

  const ar = readSrc('pages/AdminResultats.jsx');
  const au = readSrc('pages/AdminUsers.jsx');
  runTest('F1 Résultats : AppSidebar au lieu de AdminSidebar (sidebar candidats UI)', /AppSidebar/.test(ar) && !/AdminSidebar/.test(ar), 'AppSidebar');
  runTest('F1 Résultats : plus de drawer/topbar mobile à liste candidats', !/mobileSidebarOpen/.test(ar), 'retiré');
  runTest('F2 Utilisateurs : sidebar commune AppSidebar (liste + loading)',
    (au.match(/sidebar=\{<AppSidebar \/>\}/g) || []).length >= 2, `${(au.match(/sidebar=\{<AppSidebar \/>\}/g) || []).length} instances`);
  runTest('F3 Utilisateurs : plus de updateUserProfile/resetPassword', !/updateUserProfile/.test(au) && !/resetPassword/.test(au), 'statut via updateUserActive');

  // ---- G. Compte & distinction Utilisateurs/Comptes/Mon compte ----
  console.log('\n--- G. Compte & distinction ---\n');

  const prof = readSrc('pages/Profile.jsx');
  runTest('G1 Compte : gating profile.view/profile.edit', /profile\.view/.test(prof) && /profile\.edit/.test(prof), 'can(profile.view/edit)');
  runTest('G2 Compte : sync formData dans useEffect (plus de setState en render)', /useState\(EMPTY_FORM\)/.test(prof) && !/syncedProfileId/.test(prof), 'useEffect');
  runTest('G3 Compte : rôle affiché dynamiquement (roles du contexte)', /computeRoleDisplay/.test(prof) && /roles\s*\?\?/.test(prof), 'dynamique');
  const admDetail = readSrc('pages/AdminUserDetail.jsx');
  runTest('G4 Détail : perso en lecture seule (aucun éditeur perso)', !/updateUserProfile/.test(admDetail) && !/Enregistrer les modifications/.test(admDetail), 'display-only');
  runTest('G5 Détail : roles gated par assignableRoles + promotions', /assignableRoles\.includes/.test(admDetail) && /canPromoteSuperAdmin/.test(admDetail), 'gated');

  // ---- H. Cohérence globale ----
  console.log('\n--- H. Cohérence globale ---\n');

  const layout = readSrc('components/layout/ApplicationLayout.jsx');
  runTest('H1 pages super-admin rendues avec la Sidebar commune',
    /Sidebar/.test(layout), 'ApplicationLayout');
  const trio = ['pages/SuperAdminAccounts.jsx', 'pages/AdminUsers.jsx', 'pages/AdminUserDetail.jsx'];
  const trioOk = trio.every((p) => /useEffectiveAuthority/.test(readSrc(p)));
  runTest('H2 trio admin (Comptes / Utilisateurs / Détail) utilise useEffectiveAuthority', trioOk, trio.join(', '));
  runTest('H2 Accès : UI pilotée par useAccessControl (backend source de vérité)',
    /useAccessControl/.test(readSrc('pages/SuperAdminAccess.jsx')), 'useAccessControl');
  runTest('H3 plus de setUserRoles dans Comptes', !/setUserRoles\s*\(/.test(saa), 'setUserRoles retiré');

  for (const id of cleanup) {
    try {
      if (id.startsWith('role:')) await supabaseAdmin.from('role_permissions').delete().eq('role_id', id.slice(5));
      if (id.startsWith('role:')) await supabaseAdmin.from('user_roles').delete().eq('role_id', id.slice(5));
      if (id.startsWith('role:')) await supabaseAdmin.from('roles').delete().eq('id', id.slice(5));
      else await supabaseAdmin.auth.admin.deleteUser(id);
    } catch { /* cleanup best effort */ }
  }

  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P4.4 FUNCIONNEL VALIDÉ - READY_FOR_REPORT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });