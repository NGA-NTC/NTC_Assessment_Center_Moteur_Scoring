// Test P4.1: Consolidation de la navigation Super Admin sur le Route Registry + autorité effective
// 0) Contrat registre réel : /super-admin/* sous ApplicationLayout + guards conservés, aucun UUID hardcodé,
//    SuperAdminSidebar ne génère plus de liens statiques
// 1) Mécanique de navigation (buildNavigation) : permission/capacité vs repli guard, rôle non-décisif
// 2) Autorité effective réelle (get_effective_authority) : super_admin plein / permission seule / expirée
// Supabase local attendu sur http://127.0.0.1:54321
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildNavigation } from '../../../src/routes/navigation/index.js';

const REGISTRY_PATH = fileURLToPath(new URL('../../../src/routes/registry/index.jsx', import.meta.url));
const SUPERADMIN_SIDEBAR_PATH = fileURLToPath(new URL('../../../src/components/layout/SuperAdminSidebar.jsx', import.meta.url));
const GUARDS_PATH = fileURLToPath(new URL('../../../src/routes/guards/index.js', import.meta.url));

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Miroir du registre (contrat : guard + access + navigation). Le registre réel (JSX)
// n'est pas importable par Node ; les déclarations ci-dessous reflètent index.jsx.
const superAdminChildren = [
  { key: 'tableauDeBord', path: '/super-admin', guard: 'superAdmin', navigation: { show: true, section: 'administration', order: 10 } },
  { key: 'comptes', path: '/super-admin/comptes', guard: 'superAdmin', navigation: { show: true, section: 'administration', order: 40 } },
  { key: 'roles', path: '/super-admin/roles', guard: 'superAdmin', navigation: { show: true, section: 'administration', order: 50 } },
  { key: 'acces', path: '/super-admin/acces', guard: 'superAdmin',
    access: { type: 'permission', permission: 'rbac.role_permissions', capability: 'MANAGE' },
    navigation: { show: true, section: 'administration', order: 60 } },
  { key: 'pages', path: '/super-admin/pages', guard: 'superAdmin', navigation: { show: true, section: 'administration', order: 70 } },
  { key: 'fonctionnalites', path: '/super-admin/fonctionnalites', guard: 'superAdmin', navigation: { show: true, section: 'administration', order: 80 } },
];

const topNavRoutes = [
  { key: 'test', path: '/test', guard: 'user',
    access: { type: 'permission', permission: 'assessment.take', capability: 'USE' },
    navigation: { show: true, section: 'administration', order: 90 } },
  { key: 'modifierMotDePasse', path: '/modifier-mot-de-passe', guard: 'user', access: { type: 'user' },
    navigation: { show: true, section: 'compte', order: 20 } },
  { key: 'compte', path: '/compte', guard: 'user', access: { type: 'user' },
    navigation: { show: true, section: 'compte', order: 10 } },
  { key: 'resultats', path: '/admin', guard: 'admin', access: { type: 'permission', permission: 'results.view' },
    navigation: { show: true, section: 'administration', order: 20 } },
  { key: 'utilisateurs', path: '/admin/utilisateurs', guard: 'admin', access: { type: 'permission', permission: 'users.view' },
    navigation: { show: true, section: 'administration', order: 30 } },
  { key: 'modeTest', path: '/admin/mode-test/:id', guard: 'admin',
    access: { type: 'permission', permission: 'results.view' }, navigation: { show: false } },
];

const allRoutesMirror = [
  ...topNavRoutes,
  { key: 'superAdmin', guard: 'superAdmin', children: superAdminChildren },
];

const SUPER_ADMIN_EXPECTED = [
  'tableauDeBord', 'comptes', 'roles', 'acces', 'pages', 'fonctionnalites',
  'resultats', 'utilisateurs', 'test', 'compte', 'modifierMotDePasse',
];

function keys(itemsOpt) {
  return (itemsOpt || []).map((i) => i.key).sort();
}

const results = [];
function runTest(name, cond, detail) {
  const status = cond ? 'PASS' : 'FAIL';
  results.push({ name, status });
  console.log(`${name} = ${status}${cond && detail ? ' (' + detail + ')' : ''}${!cond ? ' -> ' + detail : ''}`);
}

async function main() {
  console.log('=== P4.1: Navigation Super Admin = Route Registry + autorité effective ===\n');

  // ---- PARTIE 0 : contrat du registre réel (lecture statique, JSX non importable par Node) ----
  console.log('--- 0. Contrat registre réel ---\n');
  const regSource = readFileSync(REGISTRY_PATH, 'utf8');
  const sidebarSource = readFileSync(SUPERADMIN_SIDEBAR_PATH, 'utf8');
  const guardsSource = readFileSync(GUARDS_PATH, 'utf8');

  // R1 : le groupe superAdmin utilise ApplicationLayout (layout declaratif du registry).
  const superBlock = regSource.slice(regSource.indexOf('key: "superAdmin"'), regSource.indexOf('key: "notFound"'));
  runTest('R1 groupe superAdmin -> layout ApplicationLayout', /layout: ApplicationLayout/.test(superBlock), 'layout déclaratif');
  runTest('R1 groupe superAdmin -> guard "superAdmin" conservé', /guard: "superAdmin"/.test(superBlock), 'guard conservé');

  // R2 : les 6 routes super-admin gardent leurs guards ; uniquement acces déclare une permission.
  ['tableauDeBord', 'comptes', 'roles', 'pages', 'fonctionnalites'].forEach((k) => {
    const block = superBlock.slice(superBlock.indexOf(`key: "${k}"`), superBlock.indexOf(`key: "${k}"`) + 160);
    runTest(`R2 ${k} -> guard superAdmin, sans access`, /guard: "superAdmin"/.test(block) && !/access:/.test(block), 'guard seul');
  });
  const accesBlock = superBlock.slice(superBlock.indexOf('key: "acces"'), superBlock.indexOf('key: "acces"') + 420);
  runTest('R2 acces -> guard superAdmin + access rbac.role_permissions MANAGE (seule route à permission)',
    /guard: "superAdmin"/.test(accesBlock) && /permission: "rbac\.role_permissions"/.test(accesBlock) && /capability: "MANAGE"/.test(accesBlock),
    'guard + access');

  // R3 : SuperAdminSidebar ne génère plus de liens statiques (registry source de vérité).
  runTest('R3 SuperAdminSidebar -> utilisait des NAV_ITEMS statiques (plus aucun)', !/NAV_ITEMS/.test(sidebarSource), 'supression NAV_ITEMS');
  runTest('R3 SuperAdminSidebar -> consomme buildNavigation(routes)', /buildNavigation/.test(sidebarSource), 'buildNavigation présent');
  runTest('R3 SuperAdminSidebar -> rendu via Sidebar registry-driven', /from "\.\/Sidebar\.jsx"/.test(sidebarSource), 'Sidebar importé');

  // E : aucun UUID hardcodé dans le registre ni dans SuperAdminSidebar.
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  runTest('E aucun UUID hardcodé dans le registre', !uuidRe.test(regSource), 'registre propre');
  runTest('E aucun UUID hardcodé dans SuperAdminSidebar', !uuidRe.test(sidebarSource), 'sidebar propre');

  // G : les guards existent toujours et la correspondance role -> guard reste déclarative.
  runTest('G correspondance guards conservée (user/admin/superAdmin)', /user: UserRoute/.test(guardsSource) && /admin: ProtectedRoute/.test(guardsSource) && /superAdmin: SuperAdminRoute/.test(guardsSource), 'ROUTE_GUARDS intact');

  // ---- PARTIE 1 : mécanique de navigation (pure JS) ----
  console.log('\n--- 1. buildNavigation : permission+capacité, rôle non décisif, repli guard ---\n');

  // A : super_admin "plein" -> toutes les routes de navigation.
  const ctxSuperAdminFull = { user: { id: 'u1' }, isAdmin: true, hasRole: (r) => r === 'super_admin', canPermission: () => true };
  const itemsA = keys(buildNavigation(allRoutesMirror, ctxSuperAdminFull));
  runTest('A super_admin plein -> navigation complète (11 liens)', JSON.stringify(itemsA) === JSON.stringify([...SUPER_ADMIN_EXPECTED].sort()), `items=${itemsA.join(',')}`);

  // B : simple porteur de results.view (sans conviction super_admin) -> PAS d\'accès aux routes super-admin.
  const ctxResultsOnly = { user: { id: 'u2' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'results.view' && c === 'USE' };
  const itemsB = keys(buildNavigation(allRoutesMirror, ctxResultsOnly));
  const noSuperAdminLinksB = !['tableauDeBord', 'comptes', 'roles', 'pages', 'fonctionnalites'].some((k) => itemsB.includes(k));
  runTest('B results.view seul -> AUCUN lien super-admin', noSuperAdminLinksB, `items=${itemsB.join(',')}`);
  runTest('B results.view seul -> resultats visible (guard admin + permission)', itemsB.includes('resultats'), `items=${itemsB.join(',')}`);
  runTest('B results.view seul -> acces caché (permission MANAGE absente)', !itemsB.includes('acces'), `items=${itemsB.join(',')}`);

  // C : rbac.role_permissions MANAGE -> ouvre la route correspondante, pas les autres super-admin.
  const ctxManageOnly = { user: { id: 'u3' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'rbac.role_permissions' && c === 'MANAGE' };
  const itemsC = keys(buildNavigation(allRoutesMirror, ctxManageOnly));
  runTest('C MANAGE seul -> acces visible (contrat permission)', itemsC.includes('acces'), `items=${itemsC.join(',')}`);
  runTest('C MANAGE seul -> autres super-admin absents (repli guard)', !['tableauDeBord', 'comptes', 'roles', 'pages', 'fonctionnalites'].some((k) => itemsC.includes(k)), `items=${itemsC.join(',')}`);
  runTest('C MANAGE seul -> resultats/test masqués (permissions autres)', !itemsC.includes('resultats') && !itemsC.includes('test'), `items=${itemsC.join(',')}`);

  // F : le rôle n\'est PAS la source de vérité de l\'autorisation.
  const ctxRoleButNoPerms = { user: { id: 'u4' }, isAdmin: true, hasRole: (r) => r === 'super_admin', canPermission: () => false };
  const itemsF = keys(buildNavigation(allRoutesMirror, ctxRoleButNoPerms));
  runTest('F super_admin sans permissions -> acces/resultats/test cachés (permission gouverne)', !itemsF.includes('acces') && !itemsF.includes('resultats') && !itemsF.includes('test'), `items=${itemsF.join(',')}`);
  runTest('F routes sans access restent visibles par guard (défense secondaire)', ['tableauDeBord', 'comptes', 'roles', 'pages', 'fonctionnalites'].every((k) => itemsF.includes(k)), `items=${itemsF.join(',')}`);

  // ---- PARTIE 2 : autorité effective réelle (get_effective_authority) ----
  console.log('\n--- 2. get_effective_authority (DB réelle) ---\n');

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
  const hasGlobal = (rows, perm, cap = 'USE') =>
    rows.some((r) => r.permission_id === perm && r.capability === cap && r.scope_type === 'global' && r.scope_value == null);
  const makeCan = (rows, perms) => (p, c = 'USE') => !!perms.find(([perm, cap]) => perm === p && cap === c) && hasGlobal(rows, p, c);

  // D : super_admin réel -> navigation complète.
  const superAdmin = await signIn('p4_admin@test.com');
  const saRows = await effectiveAuthority(superAdmin.id, superAdmin.token);
  ['results.view', 'users.view', 'assessment.take'].forEach((perm) => {
    runTest(`D super_admin -> ${perm} USE global`, hasGlobal(saRows, perm), 'PASS -> présent');
  });
  runTest('D super_admin -> rbac.role_permissions MANAGE global', hasGlobal(saRows, 'rbac.role_permissions', 'MANAGE'), 'PASS -> présent');
  const saCtx = { user: { id: superAdmin.id }, isAdmin: true, hasRole: (r) => r === 'super_admin', canPermission: makeCan(saRows, [['rbac.role_permissions', 'MANAGE'], ['results.view', 'USE'], ['users.view', 'USE'], ['assessment.take', 'USE']]) };
  const itemsD = keys(buildNavigation(allRoutesMirror, saCtx));
  runTest('D buildNavigation avec autorité super_admin réelle -> navigation complète',
    JSON.stringify(itemsD) === JSON.stringify([...SUPER_ADMIN_EXPECTED].sort()), `items=${itemsD.join(',')}`);

  // B2 : candidat réel (rôle auto) -> ne DOIT PAS voir les liens super-admin.
  const cand = await signUp(`p4_1_cand_${Date.now()}@test.com`);
  const candRows = await effectiveAuthority(cand.id, cand.token);
  const candCtx = { user: { id: cand.id }, isAdmin: false, hasRole: () => false, canPermission: makeCan(candRows, [['results.view', 'USE'], ['users.view', 'USE'], ['rbac.role_permissions', 'MANAGE'], ['assessment.take', 'USE']]) };
  const itemsB2 = keys(buildNavigation(allRoutesMirror, candCtx));
  runTest('B2 candidat réel -> AUCUN lien super-admin', !['tableauDeBord', 'comptes', 'roles', 'acces', 'pages', 'fonctionnalites'].some((k) => itemsB2.includes(k)), `candItems=${itemsB2.join(',')}`);
  runTest('B2 candidat réel -> compte/mot-de-passe visibles (access user)', itemsB2.includes('compte') && itemsB2.includes('modifierMotDePasse'), `candItems=${itemsB2.join(',')}`);

  // C2 : permission expirée/révoquée -> disparaît après refresh.
  const expUser = await signUp(`p4_1_exp_${Date.now()}@test.com`);
  const R = 'p4_1_manage_role';
  await supabaseAdmin.from('roles').upsert({ id: R, name: 'P4.1 manage', description: 'MANAGE rbac.role_permissions (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: R, permission_id: 'rbac.role_permissions', can_use: true, can_manage: true, can_grant: false, can_delegate: false });
  await supabaseAdmin.from('user_roles').upsert({
    user_id: expUser.id, role_id: R, assigned_by: expUser.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const rowsCBefore = await effectiveAuthority(expUser.id, expUser.token);
  const ctxCBefore = { user: { id: expUser.id }, isAdmin: false, hasRole: () => false, canPermission: makeCan(rowsCBefore, [['rbac.role_permissions', 'MANAGE']]) };
  runTest('C2 avant expiration -> acces visible', buildNavigation(allRoutesMirror, ctxCBefore).map((i) => i.key).includes('acces'), 'PASS -> visible');

  await supabaseAdmin.from('user_roles').update({
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  }).eq('user_id', expUser.id).eq('role_id', R);

  const rowsCAfter = await effectiveAuthority(expUser.id, expUser.token);
  const ctxCAfter = { user: { id: expUser.id }, isAdmin: false, hasRole: () => false, canPermission: makeCan(rowsCAfter, [['rbac.role_permissions', 'MANAGE']]) };
  const itemsC2 = buildNavigation(allRoutesMirror, ctxCAfter).map((i) => i.key);
  runTest('C2 après expiration -> acces masqué (refresh cache l\'entrée)', !itemsC2.includes('acces'), `items=${itemsC2.join(',')}`);

  // Résumé
  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P4.1 VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });