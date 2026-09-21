// Test P3 S6: Sécurisation des promotions admin / super_admin
// A-I tests via supabase-js.rpc() contre le Supabase local.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function signUp(email) {
  const { data: signUp } = await supabase.auth.signUp({ email, password: 'testpassword123' });
  if (signUp.error) throw new Error(`signUp ${email}: ${signUp.error.message}`);
  const { data: signIn } = await supabase.auth.signInWithPassword({ email, password: 'testpassword123' });
  return { id: signIn.user.id, token: signIn.session.access_token };
}

async function setup() {
  const ns = (n) => `p3s6_${n}@test.com`;

  const actorA = await signUp(ns('a_changeonly'));
  const actorB = await signUp(ns('b_promote_admin'));
  const actorC = await signUp(ns('c_full'));
  const actorC2 = await signUp(ns('c2_full_norow'));
  const actorD = await signUp(ns('d_promote_only'));
  const actorE = await signUp(ns('e_self'));
  const actorF = await signUp(ns('f_scope'));
  const actorH = await signUp(ns('h_expired'));
  const actorI = await signUp(ns('i_revoke'));
  const targetX = await signUp(ns('target_x'));
  const targetI = await signUp(ns('target_i'));

  // Rôles de test dédiés (catalogs propres, n'interfèrent pas avec admin/super_admin)
  const roles = [
    { id: 'p3s6_change_only', name: 'P3S6 change only', description: 'GRANT users.change_role uniquement' },
    { id: 'p3s6_promote_admin', name: 'P3S6 promote admin', description: 'change_role + promote_admin' },
    { id: 'p3s6_promote_only', name: 'P3S6 promote only', description: 'promote_admin + promote_super_admin SANS change_role' },
    { id: 'p3s6_full', name: 'P3S6 full', description: 'change_role + promote_admin + promote_super_admin' },
    { id: 'p3s6_full_a', name: 'P3S6 full no-row', description: 'full grants mais AUCUNE assignability super_admin' },
  ];
  for (const r of roles) {
    await supabaseAdmin.from('roles').upsert({ id: r.id, name: r.name, description: r.description, is_system: false });
  }

  const grants = (roleId, perms) => Promise.all(perms.map((p) =>
    supabaseAdmin.from('role_permissions').upsert({
      role_id: roleId, permission_id: p, can_use: true, can_manage: true, can_grant: true, can_delegate: false,
    })));

  await grants('p3s6_change_only', ['users.change_role']);
  await grants('p3s6_promote_admin', ['users.change_role', 'users.promote_admin']);
  await grants('p3s6_promote_only', ['users.promote_admin', 'users.promote_super_admin']);
  await grants('p3s6_full', ['users.change_role', 'users.promote_admin', 'users.promote_super_admin']);
  await grants('p3s6_full_a', ['users.change_role', 'users.promote_admin', 'users.promote_super_admin']);

  const assign = (userId, roleId) => supabaseAdmin.from('user_roles').upsert({ user_id: userId, role_id: roleId, assigned_by: actorC.id });
  await assign(actorA.id, 'p3s6_change_only');
  await assign(actorB.id, 'p3s6_promote_admin');
  await assign(actorC.id, 'p3s6_full');
  await assign(actorC2.id, 'p3s6_full_a');
  await assign(actorD.id, 'p3s6_promote_only');
  await assign(actorE.id, 'p3s6_full');
  await assign(actorF.id, 'candidate');
  await assign(actorH.id, 'p3s6_full');
  await assign(actorI.id, 'p3s6_full');
  await assign(targetX.id, 'candidate');
  await assign(targetI.id, 'candidate');

  // Actor H : autorité EXPIRÉE (rôle expiré -> aucune capacité effective)
  await supabaseAdmin.from('user_roles').upsert({
    user_id: actorH.id, role_id: 'p3s6_full', assigned_by: actorC.id,
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  });

  // Actor I : autorité valide MAIS qui expirera avant la révocation (test I)
  await supabaseAdmin.from('user_roles').upsert({
    user_id: actorI.id, role_id: 'p3s6_full', assigned_by: actorC.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });

  // Graphe d'assignabilité pour les rôles de promotion (test setups)
  const ra = (assigner, assignable) => supabaseAdmin.from('role_assignability').upsert({
    assigner_role_id: assigner, assignable_role_id: assignable, created_by: actorC.id,
  });
  await ra('p3s6_change_only', 'candidate');
  await ra('p3s6_change_only', 'admin');
  await ra('p3s6_change_only', 'super_admin');
  await ra('p3s6_promote_admin', 'admin');
  await ra('p3s6_promote_admin', 'super_admin');
  await ra('p3s6_full', 'admin');
  await ra('p3s6_full', 'super_admin');
  // p3s6_full_a : volontairement AUCUNE ligne d'assignabilité

  // Test F : délégation role-delegation 'grant' restreinte à un AUTRE utilisateur (hors scope)
  await supabaseAdmin.from('role_delegations').upsert({
    delegator_role_id: 'p3s6_change_only',
    target_role_id: 'candidate',
    permission_id: 'users.promote_admin',
    delegation_type: 'grant',
    scope_type: 'user',
    scope_value: targetI.id,
    created_by: actorC.id,
    expires_at: null,
    revoked_at: null,
  });

  return {
    actorA, actorB, actorC, actorC2, actorD, actorE, actorF, actorH, actorI, targetX, targetI,
  };
}

function makeClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

async function expectError(name, client, args, expectedFragment) {
  const { error } = await client.rpc('assign_user_role', args);
  if (error && error.message.includes(expectedFragment)) return { success: true, detail: error.message };
  throw new Error(`Attendu '${expectedFragment}' mais: ${error ? error.message : "PAS D'ERREUR (attribution acceptée !)"}`);
}

async function main() {
  console.log('=== P3 S6: Promotions admin / super_admin ===\n');

  const ctx = await setup();
  console.log('Setup terminé.');

  const results = [];
  async function runTest(name, fn) {
    console.log(`\n=== ${name} ===`);
    try {
      const r = await fn();
      console.log(`${name} = PASS${r && r.detail ? ' (' + r.detail + ')' : ''}`);
      results.push({ name, status: 'PASS' });
    } catch (e) {
      console.log(`${name} = FAIL: ${e.message}`);
      results.push({ name, status: 'FAIL', error: e.message });
    }
  }

  async function testA() {
    console.log('A — users.change_role seul : rôles ordinaires OK, promotions REFUSÉES');
    const c = makeClient(ctx.actorA.token);
    const { error: eCandidate } = await c.rpc('assign_user_role', { p_target_user_id: ctx.targetX.id, p_role_id: 'candidate', p_expires_at: null });
    if (eCandidate) throw new Error(`Attribution candidate refusée: ${eCandidate.message}`);
    await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'admin', p_expires_at: null }, 'PROMOTION_INTERDITE');
    await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'super_admin', p_expires_at: null }, 'PROMOTION_INTERDITE');
    return { success: true };
  }

  async function testB() {
    console.log('B — change_role + promote_admin : admin OK, super_admin REFUSÉ');
    const c = makeClient(ctx.actorB.token);
    const { error } = await c.rpc('assign_user_role', { p_target_user_id: ctx.targetX.id, p_role_id: 'admin', p_expires_at: null });
    if (error) throw new Error(`Attribution admin refusée: ${error.message}`);
    return expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'super_admin', p_expires_at: null }, 'PROMOTION_INTERDITE');
  }

  async function testC() {
    console.log('C — full grants + assignability : super_admin OK ; sans assignability : REFUS');
    const c = makeClient(ctx.actorC.token);
    const c2 = makeClient(ctx.actorC2.token);
    const { error } = await c.rpc('assign_user_role', { p_target_user_id: ctx.targetI.id, p_role_id: 'super_admin', p_expires_at: null });
    if (error) throw new Error(`Attribution super_admin refusée: ${error.message}`);
    await expectError(' ', c2, { p_target_user_id: ctx.targetI.id, p_role_id: 'super_admin', p_expires_at: null }, 'ASSIGNABILITY_INTERDITE');
    return { success: true };
  }

  async function testD() {
    console.log('D — promote_* SANS change_role : REFUS (change_role reste requis)');
    const c = makeClient(ctx.actorD.token);
    await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'admin', p_expires_at: null }, 'PERMISSION_INSUFFISANTE');
    await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'super_admin', p_expires_at: null }, 'PERMISSION_INSUFFISANTE');
    return { success: true };
  }

  async function testE() {
    console.log('E — Auto-attribution : REFUS même avec tous les grants');
    const c = makeClient(ctx.actorE.token);
    await expectError(' ', c, { p_target_user_id: ctx.actorE.id, p_role_id: 'admin', p_expires_at: null }, 'AUTO_ATTRIBUTION_INTERDITE');
    return { success: true };
  }

  async function testF() {
    console.log('F — Scope hors couverture (délégation limitée à un autre utilisateur) : REFUS');
    const c = makeClient(ctx.actorF.token);
    await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'admin', p_expires_at: null }, 'PERMISSION_INSUFFISANTE');
    return { success: true };
  }

  async function testG() {
    console.log('G — Rôle non assignable (is_assignable=false) : REFUS');
    await supabaseAdmin.from('roles').update({ is_assignable: false }).eq('id', 'candidate');
    try {
      const c = makeClient(ctx.actorB.token);
      await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'candidate', p_expires_at: null }, 'ROLE_NON_ASSIGNABLE');
      return { success: true };
    } finally {
      await supabaseAdmin.from('roles').update({ is_assignable: true }).eq('id', 'candidate');
    }
  }

  async function testH() {
    console.log('H — Autorité expirée : aucune attribution possible');
    const c = makeClient(ctx.actorH.token);
    await expectError(' ', c, { p_target_user_id: ctx.targetX.id, p_role_id: 'admin', p_expires_at: null }, 'PERMISSION_INSUFFISANTE');
    return { success: true };
  }

  async function testI() {
    console.log('I — Une promotion ne donne PAS un droit permanent de révocation');
    const c = makeClient(ctx.actorI.token);
    const { error: promoteError } = await c.rpc('assign_user_role', {
      p_target_user_id: ctx.targetI.id, p_role_id: 'admin', p_expires_at: null,
    });
    if (promoteError) throw new Error(`Promotion initiale refusée: ${promoteError.message}`);

    await supabaseAdmin.from('user_roles').update({
      expires_at: new Date(Date.now() - 86400000).toISOString(),
    }).eq('user_id', ctx.actorI.id).eq('role_id', 'p3s6_full');

    const { error } = await c.rpc('revoke_user_role', { p_target_user_id: ctx.targetI.id, p_role_id: 'admin' });
    if (error && error.message.includes('PERMISSION_INSUFFISANTE')) return { success: true, detail: 'révocation refusée après expiration' };
    if (!error) throw new Error("Révocation autorisée après expiration de l'autorité (bypass !)");
    throw new Error(error.message);
  }

  const tests = [
    { name: 'A', fn: testA },
    { name: 'B', fn: testB },
    { name: 'C', fn: testC },
    { name: 'D', fn: testD },
    { name: 'E', fn: testE },
    { name: 'F', fn: testF },
    { name: 'G', fn: testG },
    { name: 'H', fn: testH },
    { name: 'I', fn: testI },
  ];

  for (const t of tests) {
    await runTest(t.name, t.fn);
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log('| Test | Résultat |');
  console.log('|------|----------|');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.status} |`);
  }
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.length - pass;
  console.log(`\nTotal: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail === 0) console.log('\n✅ P3 S6 VALIDÉE - READY_FOR_NEXT');
  else console.log('\n❌ NO_GO');
}

main().catch(console.error);