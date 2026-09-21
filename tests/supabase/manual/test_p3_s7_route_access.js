// Test P3 S7: Alignement des routes Super Admin sur l'autorité effective
// 1) Mécanique de navigation (buildNavigation) : permission + capacité vs repli guard
// 2) Autorité effective réelle (get_effective_authority) : super_admin / non-super_admin / expirée
// Supabase local attendu sur http://127.0.0.1:54321
import { createClient } from '@supabase/supabase-js';
import { buildNavigation } from '../../../src/routes/navigation/index.js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Déclarations miroir du registre (contrat : guard + access).
const superAdminChildren = [
  { key: 'tableauDeBord', path: '/super-admin', guard: 'superAdmin', navigation: { show: true } },
  { key: 'comptes', path: '/super-admin/comptes', guard: 'superAdmin', navigation: { show: true } },
  { key: 'roles', path: '/super-admin/roles', guard: 'superAdmin', navigation: { show: true } },
  { key: 'acces', path: '/super-admin/acces', guard: 'superAdmin',
    access: { type: 'permission', permission: 'rbac.role_permissions', capability: 'MANAGE' },
    navigation: { show: true } },
  { key: 'pages', path: '/super-admin/pages', guard: 'superAdmin', navigation: { show: true } },
  { key: 'fonctionnalites', path: '/super-admin/fonctionnalites', guard: 'superAdmin', navigation: { show: true } },
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
  console.log('=== P3 S7: Routes Super Admin / autorité effective ===\n');

  // ---- PARTIE 1 : mécanique de navigation (pure JS) ----
  console.log('--- 1. buildNavigation : permission+capacité vs repli guard ---\n');

  const ctxSuperAdmin = { user: { id: 'u1' }, isAdmin: true, hasRole: (r) => r === 'super_admin', canPermission: () => false };

  // T1 : super_admin sans autorité MANAGE -> acces MASQUÉ (UX guide par l'autorité), autres via guard
  const itemsT1 = keys(buildNavigation(superAdminChildren, ctxSuperAdmin));
  runTest('T1 acces caché sans MANAGE même super_admin', !itemsT1.includes('acces'), `items=${itemsT1.join(',')}`);
  runTest('T1 autres routes super-admin visibles (guard)', JSON.stringify(keys(superAdminChildren).filter(k => k !== 'acces').sort()) === JSON.stringify(itemsT1), `items=${itemsT1.join(',')}`);

  const ctxManaged = { user: { id: 'u2' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'rbac.role_permissions' && c === 'MANAGE' };

  // T2 : NON super-admin avec autorité MANAGE -> acces VISIBLE, autres super-admin cachés (repli guard)
  const itemsT2 = keys(buildNavigation(superAdminChildren, ctxManaged));
  runTest('T2 acces visible via autorité (sans rôle super_admin)', itemsT2.includes('acces') && itemsT2.length === 1, `items=${itemsT2.join(',')}`);

  // T3 : sans autorité du tout -> acces caché
  const ctxNone = { user: { id: 'u3' }, isAdmin: false, hasRole: () => false, canPermission: () => false };
  const itemsT3 = keys(buildNavigation(superAdminChildren, ctxNone));
  runTest('T3 acces caché sans autorité', itemsT3.length === 0, `items=${itemsT3.join(',')}`);

  // T4 : échec de chargement d'autorité (map absente -> canPermission false) -> acces caché, guard intact
  const ctxLoading = { user: { id: 'u4' }, isAdmin: false, hasRole: () => false, canPermission: () => false };
  const itemsT4 = keys(buildNavigation(superAdminChildren, ctxLoading));
  runTest('T4 autorité indisponible -> acces caché (comportement dégradé sûr)', itemsT4.length === 0, `items=${itemsT4.join(',')}`);

  // T5 : guard toujours appliqué pour les routes non migrées (comptes/roles/pages/fonctionnalites/dashboard)
  const ctxSuperAdminAll = { user: { id: 'u5' }, isAdmin: true, hasRole: (r) => r === 'super_admin', canPermission: (p, c) => p === 'rbac.role_permissions' && c === 'MANAGE' };
  const itemsT5 = keys(buildNavigation(superAdminChildren, ctxSuperAdminAll));
  runTest('T5 super_admin : toutes les routes visibles', itemsT5.length === superAdminChildren.length, `items=${itemsT5.join(',')}`);

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
  const hasManageGlobal = (rows, perm) => rows.some((r) => r.permission_id === perm && r.capability === 'MANAGE' && r.scope_type === 'global' && r.scope_value == null);

  // T6 : un super_admin dispose de rbac.role_permissions MANAGE global
  const superAdmin = await signIn('p4_admin@test.com');
  const saRows = await effectiveAuthority(superAdmin.id, superAdmin.token);
  runTest('T6 super_admin -> rbac.role_permissions MANAGE global',
    hasManageGlobal(saRows, 'rbac.role_permissions'),
    `PASS -> MANAGE présent`);

  // T7 : un candidat ne dispose PAS de rbac.role_permissions (aucune capacité)
  const candidate = await signUp(`p3s7_cand_${Date.now()}@test.com`);
  const candRows = await effectiveAuthority(candidate.id, candidate.token);
  runTest('T7 candidat -> AUCUNE capacité rbac.role_permissions',
    !hasManageGlobal(candRows, 'rbac.role_permissions') && !candRows.some((r) => r.permission_id === 'rbac.role_permissions'),
    `PASS -> aucune capacité`);

  // T8 : autorité expirée / révoquée -> rbac.role_permissions MANAGE disparaît après refresh
  const expUser = await signUp(`p3s7_exp_${Date.now()}@test.com`);
  const R = 'p3s7_access_role';
  await supabaseAdmin.from('roles').upsert({ id: R, name: 'P3S7 access', description: 'MANAGE rbac.role_permissions (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: R, permission_id: 'rbac.role_permissions', can_use: true, can_manage: true, can_grant: false, can_delegate: false });
  await supabaseAdmin.from('user_roles').upsert({
    user_id: expUser.id, role_id: R, assigned_by: expUser.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const rowsBefore = await effectiveAuthority(expUser.id, expUser.token);
  runTest('T8 avant expiration -> MANAGE présent', hasManageGlobal(rowsBefore, 'rbac.role_permissions'), 'PASS -> MANAGE présent');

  await supabaseAdmin.from('user_roles').update({
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  }).eq('user_id', expUser.id).eq('role_id', R);

  const rowsAfter = await effectiveAuthority(expUser.id, expUser.token);
  runTest('T8 après expiration -> MANAGE disparu (refresh cache l\'entrée)', !hasManageGlobal(rowsAfter, 'rbac.role_permissions'), 'PASS -> MANAGE absent');

  // Résumé
  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P3 S7 VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });