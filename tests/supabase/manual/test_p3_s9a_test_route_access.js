// Test P3 S9-A: Alignement de /test sur assessment.take (USE)
// 1) Mécanique de navigation (buildNavigation) : permission assessment.take + USE vs repli
// 2) Autorité effective réelle (get_effective_authority) : porteur / non-porteur / expirée
// Supabase local attendu sur http://127.0.0.1:54321
import { createClient } from '@supabase/supabase-js';
import { buildNavigation } from '../../../src/routes/navigation/index.js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Déclaration miroir du registre (contrat : /test -> assessment.take USE).
const testRoute = {
  key: 'test',
  path: '/test',
  guard: 'user',
  access: { type: 'permission', permission: 'assessment.take', capability: 'USE' },
  navigation: { show: true },
};

function keys(itemsOpt) {
  return (itemsOpt || []).map((i) => i.key);
}

const results = [];
function runTest(name, cond, detail) {
  const status = cond ? 'PASS' : 'FAIL';
  results.push({ name, status });
  console.log(`${name} = ${status}${cond && detail ? ' (' + detail + ')' : ''}${!cond ? ' -> ' + detail : ''}`);
}

async function main() {
  console.log('=== P3 S9-A: /test aligné sur assessment.take (USE) ===\n');

  // ---- PARTIE 1 : mécanique de navigation (pure JS) ----
  console.log('--- 1. buildNavigation : assessment.take USE gouverne la visibilité ---\n');

  // A : utilisateur authentifié avec assessment.take USE -> "Passer le test" visible
  const ctxWithTake = { user: { id: 'u1' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'assessment.take' && c === 'USE' };
  const itemsA = keys(buildNavigation([testRoute], ctxWithTake));
  runTest('A porteur assessment.take(USE) -> visible', itemsA.includes('test'), `items=${itemsA.join(',')}`);

  // B : utilisateur sans assessment.take -> masqué
  const ctxNoTake = { user: { id: 'u2' }, isAdmin: false, hasRole: () => false, canPermission: () => false };
  const itemsB = keys(buildNavigation([testRoute], ctxNoTake));
  runTest('B non-porteur -> masqué', itemsB.length === 0, `items=${itemsB.join(',')}`);

  // C adapté : capacité présente mais pas USE (ex. MANAGE seulement) -> masqué
  const ctxManageOnly = { user: { id: 'u3' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'assessment.take' && c === 'MANAGE' };
  const itemsC = keys(buildNavigation([testRoute], ctxManageOnly));
  runTest('C capacité autre que USE -> masqué', itemsC.length === 0, `items=${itemsC.join(',')}`);

  // E : le rôle n'est PAS consulté (super_admin sans take -> masqué ; non-admin avec take -> visible)
  const ctxSuperAdminNoTake = { user: { id: 'u4' }, isAdmin: true, hasRole: (r) => r === 'super_admin', canPermission: () => false };
  const itemsE1 = keys(buildNavigation([testRoute], ctxSuperAdminNoTake));
  runTest('E super_admin sans take -> masqué (rôle non décisif)', itemsE1.length === 0, `items=${itemsE1.join(',')}`);

  const ctxNonAdminWithTake = { user: { id: 'u5' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'assessment.take' && c === 'USE' };
  const itemsE2 = keys(buildNavigation([testRoute], ctxNonAdminWithTake));
  runTest('E non-admin avec take -> visible (rôle non requis)', itemsE2.includes('test'), `items=${itemsE2.join(',')}`);

  // Dégradé sûr : autorité indisponible (canPermission false) -> masqué, guard intact
  const ctxLoading = { user: { id: 'u6' }, isAdmin: false, hasRole: () => false, canPermission: () => false };
  const itemsL = keys(buildNavigation([testRoute], ctxLoading));
  runTest('Autorité indisponible -> masqué (dégradé sûr)', itemsL.length === 0, `items=${itemsL.join(',')}`);

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
  const hasTakeUseGlobal = (rows) =>
    rows.some((r) => r.permission_id === 'assessment.take' && r.capability === 'USE' && r.scope_type === 'global' && r.scope_value == null);
  const canTake = (rows) => (p, c) => p === 'assessment.take' && c === 'USE' && hasTakeUseGlobal(rows);

  // A2 : super_admin -> assessment.take USE global -> visible
  const superAdmin = await signIn('p4_admin@test.com');
  const saRows = await effectiveAuthority(superAdmin.id, superAdmin.token);
  runTest('A2 super_admin -> assessment.take USE global', hasTakeUseGlobal(saRows), 'PASS -> USE présent');
  runTest('A2 buildNavigation avec autorité super_admin -> visible',
    keys(buildNavigation([testRoute], { user: { id: superAdmin.id }, isAdmin: true, hasRole: () => false, canPermission: canTake(saRows) })).includes('test'),
    'PASS -> visible');

  // A3 : candidat (rôle auto-attribué handle_new_user) -> assessment.take USE -> visible
  const cand = await signUp(`p3s9_cand_${Date.now()}@test.com`);
  const candRows = await effectiveAuthority(cand.id, cand.token);
  runTest('A3 candidat -> assessment.take USE global', hasTakeUseGlobal(candRows), 'PASS -> USE présent');

  // B2 : rôle sans assessment.take -> masqué
  const noTake = await signUp(`p3s9_notake_${Date.now()}@test.com`);
  const R_NOT = 'p3s9_no_take';
  await supabaseAdmin.from('roles').upsert({ id: R_NOT, name: 'P3S9 no take', description: 'sans assessment.take (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: R_NOT, permission_id: 'profile.view', can_use: true, can_manage: false, can_grant: false, can_delegate: false });
  await supabaseAdmin.from('user_roles').delete().eq('user_id', noTake.id);
  await supabaseAdmin.from('user_roles').upsert({ user_id: noTake.id, role_id: R_NOT, assigned_by: noTake.id });
  const noTakeRows = await effectiveAuthority(noTake.id, noTake.token);
  const itemsB2 = keys(buildNavigation([testRoute], { user: { id: noTake.id }, isAdmin: false, hasRole: () => false, canPermission: canTake(noTakeRows) }));
  runTest('B2 rôle sans assessment.take -> masqué', itemsB2.length === 0, `items=${itemsB2.join(',')}`);

  // C2 : assessment.take expirée/révoquée -> visible avant, masqué après refresh
  const exp = await signUp(`p3s9_exp_${Date.now()}@test.com`);
  const R_TAKE = 'p3s9_take_role';
  await supabaseAdmin.from('roles').upsert({ id: R_TAKE, name: 'P3S9 take', description: 'assessment.take (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: R_TAKE, permission_id: 'assessment.take', can_use: true, can_manage: false, can_grant: false, can_delegate: false });
  await supabaseAdmin.from('user_roles').delete().eq('user_id', exp.id);
  await supabaseAdmin.from('user_roles').upsert({
    user_id: exp.id, role_id: R_TAKE, assigned_by: exp.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const rowsBefore = await effectiveAuthority(exp.id, exp.token);
  runTest('C2 avant expiration -> assessment.take USE présent', hasTakeUseGlobal(rowsBefore), 'PASS -> USE présent');
  runTest('C2 buildNavigation avant expiration -> visible',
    keys(buildNavigation([testRoute], { user: { id: exp.id }, isAdmin: false, hasRole: () => false, canPermission: canTake(rowsBefore) })).includes('test'),
    'PASS -> visible');

  await supabaseAdmin.from('user_roles').update({
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  }).eq('user_id', exp.id).eq('role_id', R_TAKE);

  const rowsAfter = await effectiveAuthority(exp.id, exp.token);
  runTest('C2 après expiration -> USE disparu (refresh masque l\'entrée)', !hasTakeUseGlobal(rowsAfter), 'PASS -> USE absent');
  runTest('C2 buildNavigation après expiration -> masqué',
    keys(buildNavigation([testRoute], { user: { id: exp.id }, isAdmin: false, hasRole: () => false, canPermission: canTake(rowsAfter) })).length === 0,
    'PASS -> masqué');

  // Résumé
  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P3 S9-A VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });