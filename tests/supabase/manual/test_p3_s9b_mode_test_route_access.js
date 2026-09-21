// Test P3 S9-B: Alignement de /admin/mode-test/:id sur results.view (USE)
// 1) Contrat registre réel : access présent sur la route, guard conservé, pas de nav
// 2) Mécanique de navigation (buildNavigation) : results.view USE vs repli guard
// 3) Autorité effective réelle (get_effective_authority) : porteur / non-porteur / expirée
// Supabase local attendu sur http://127.0.0.1:54321
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildNavigation } from '../../../src/routes/navigation/index.js';

const REGISTRY_PATH = fileURLToPath(new URL('../../../src/routes/registry/index.jsx', import.meta.url));

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Miroir de la déclaration registre, AVEC navigation.show activée pour exercer le contrat UX.
const modeTestRoute = {
  key: 'modeTest',
  path: '/admin/mode-test/:id',
  guard: 'admin',
  access: { type: 'permission', permission: 'results.view', capability: 'USE' },
  navigation: { show: true },
};

const results = [];
function runTest(name, cond, detail) {
  const status = cond ? 'PASS' : 'FAIL';
  results.push({ name, status });
  console.log(`${name} = ${status}${cond && detail ? ' (' + detail + ')' : ''}${!cond ? ' -> ' + detail : ''}`);
}

async function main() {
  console.log('=== P3 S9-B: /admin/mode-test/:id aligné sur results.view (USE) ===\n');

  // ---- PARTIE 0 : contrat réel du registre (lecture statique, JSX non importable par Node) ----
  console.log('--- 0. Registre réel (src/routes/registry/index.jsx) ---\n');
  const regSource = readFileSync(REGISTRY_PATH, 'utf8');

  // ModeTest uniquement : guard 'admin' + access results.view, sans navigation.
  const modeBlock = regSource.slice(regSource.indexOf('key: "modeTest"'), regSource.indexOf('key: "superAdmin"'));
  runTest('R1 modeTest garde guard "admin"', /guard: "admin"/.test(modeBlock), 'guard présent');
  runTest('R2 modeTest access = results.view (USE par défaut)',
    /access: \{ type: "permission", permission: "results\.view"/.test(modeBlock), 'access results.view présent');
  runTest('R3 modeTest sans navigation (page de détail)', !/navigation:/.test(modeBlock), 'pas de navigation');

  // /test reste sur assessment.take USE ; aucune nouvelle permission ailleurs.
  const testBlock = regSource.slice(regSource.indexOf('key: "test"'), regSource.indexOf('key: "modifierMotDePasse"'));
  runTest('R4 route /test inchangée (assessment.take USE)',
    /access: \{ type: "permission", permission: "assessment\.take", capability: "USE"/.test(testBlock), 'assessment.take conservé');
  runTest('R5 seules permissions référencées : results.view, assessment.take, users.view, rbac.role_permissions',
    !/permission: "(?!results\.view|assessment\.take|users\.view|rbac\.role_permissions)/.test(regSource), 'aucune permission nouvelle');

  // ---- PARTIE 1 : mécanique de navigation (pure JS) ----
  console.log('\n--- 1. buildNavigation : results.view USE gouverne la visibilité ---\n');

  const ctxWith = { user: { id: 'u1' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'results.view' && c === 'USE' };
  runTest('A porteur results.view(USE) -> visible (rôle non requis)',
    buildNavigation([modeTestRoute], ctxWith).map((i) => i.key).includes('modeTest'), 'PASS -> visible');

  const ctxWithout = { user: { id: 'u2' }, isAdmin: true, hasRole: () => true, canPermission: () => false };
  runTest('B sans results.view même admin/super_admin -> masqué (rôle non décisif)',
    buildNavigation([modeTestRoute], ctxWithout).length === 0, 'PASS -> masqué');

  const ctxManageOnly = { user: { id: 'u3' }, isAdmin: false, hasRole: () => false, canPermission: (p, c) => p === 'results.view' && c === 'MANAGE' };
  runTest('C capacité autre que USE -> masqué',
    buildNavigation([modeTestRoute], ctxManageOnly).length === 0, 'PASS -> masqué');

  const ctxLoading = { user: { id: 'u4' }, isAdmin: false, hasRole: () => false, canPermission: () => false };
  runTest('Autorité indisponible -> masqué (dégradé sûr)',
    buildNavigation([modeTestRoute], ctxLoading).length === 0, 'PASS -> masqué');

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
  const hasResultsViewUse = (rows) =>
    rows.some((r) => r.permission_id === 'results.view' && r.capability === 'USE' && r.scope_type === 'global' && r.scope_value == null);
  const canResults = (rows) => (p, c) => p === 'results.view' && c === 'USE' && hasResultsViewUse(rows);
  const visibleWith = (rows, ctx) => buildNavigation([modeTestRoute], { ...ctx, canPermission: canResults(rows) }).map((i) => i.key).includes('modeTest');

  const superAdmin = await signIn('p4_admin@test.com');
  const saRows = await effectiveAuthority(superAdmin.id, superAdmin.token);
  runTest('A2 super_admin -> results.view USE global', hasResultsViewUse(saRows), 'PASS -> USE présent');
  runTest('A2 buildNavigation super_admin -> visible', visibleWith(saRows, { user: { id: superAdmin.id }, isAdmin: true, hasRole: () => false }), 'PASS -> visible');

  const candidate = await signUp(`p3s9b_cand_${Date.now()}@test.com`);
  const candRows = await effectiveAuthority(candidate.id, candidate.token);
  runTest('B2 candidat (assessment.take mais PAS results.view) -> masqué',
    visibleWith(candRows, { user: { id: candidate.id }, isAdmin: false, hasRole: () => false }) === false, 'PASS -> masqué');

  const exp = await signUp(`p3s9b_exp_${Date.now()}@test.com`);
  const R = 'p3s9b_result_role';
  await supabaseAdmin.from('roles').upsert({ id: R, name: 'P3S9B result', description: 'results.view (test)' });
  await supabaseAdmin.from('role_permissions').upsert({ role_id: R, permission_id: 'results.view', can_use: true, can_manage: false, can_grant: false, can_delegate: false });
  await supabaseAdmin.from('user_roles').delete().eq('user_id', exp.id);
  await supabaseAdmin.from('user_roles').upsert({
    user_id: exp.id, role_id: R, assigned_by: exp.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const rowsBefore = await effectiveAuthority(exp.id, exp.token);
  runTest('C2 avant expiration -> results.view USE présent', hasResultsViewUse(rowsBefore), 'PASS -> USE présent');
  runTest('C2 buildNavigation avant expiration -> visible', visibleWith(rowsBefore, { user: { id: exp.id }, isAdmin: false, hasRole: () => false }), 'PASS -> visible');

  await supabaseAdmin.from('user_roles').update({
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  }).eq('user_id', exp.id).eq('role_id', R);

  const rowsAfter = await effectiveAuthority(exp.id, exp.token);
  runTest('C2 après expiration -> USE disparu', !hasResultsViewUse(rowsAfter), 'PASS -> USE absent');
  runTest('C2 buildNavigation après expiration -> masqué', visibleWith(rowsAfter, { user: { id: exp.id }, isAdmin: false, hasRole: () => false }) === false, 'PASS -> masqué');

  // Résumé
  console.log('\n=== RÉSUMÉ ===');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  results.forEach((r) => console.log(`| ${r.name} | ${r.status} |`));
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P3 S9-B VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch((e) => { console.error(e); });