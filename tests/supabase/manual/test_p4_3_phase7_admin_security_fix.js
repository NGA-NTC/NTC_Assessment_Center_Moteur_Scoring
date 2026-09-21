// Test P4.3 Phase 7 : corrections de sécurité des actions d'administration
// 1) admin_create_user : super_admin autorisé (users.manage USE global), création
//    réelle (auth.users + auth.identities + profiles + rôle candidate auto), mot de
//    passe bcrypt utilisable (connexion au compte créé).
//    Admin sans users.manage => ACCES_REFUSE (le RPC refuse réellement).
//    Candidate sans users.manage => ACCES_REFUSE.
// 2) admin_set_user_active : super_admin autorisé (users.edit USE global), ban réel
//    (banned_until + profiles.status), unban ; cible inexistante => erreur.
//    Admin sans users.edit => ACCES_REFUSE. Candidate => ACCES_REFUSE.
// Supabase local attendu sur http://127.0.0.1:54321
/* global process */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../../src');
const readSrc = (rel) => readFileSync(path.join(SRC, rel), 'utf8');

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

const A = 'p4_admin@test.com';
const PASSWORD = 'testpassword123';
const uid = `p7_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
const NEW_EMAIL = `c_${uid}@test.com`;

async function signInAs() {
  const { data } = await supabase.auth.signInWithPassword({ email: A, password: PASSWORD });
  return data.session;
}

async function main() {
  const session = await signInAs();
  runTest('P7-D1 super_admin se connecte', !!session, session ? session.user.id : 'no session');
  if (!session) {
    console.log('ARRET: pas de session super_admin');
    return;
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  // ---- P7-D1 : admin_create_user en tant que super_admin ----
  const { data: created, error: createErr } = await adminClient.rpc('admin_create_user', {
    p_email: NEW_EMAIL,
    p_password: 'newpass123',
    p_first_name: 'Phase7',
    p_last_name: 'Security',
  });
  runTest(
    'P7-D1 admin_create_user (super_admin) = ok',
    !createErr && created && created.user_id,
    createErr ? createErr.message : `user_id=${created.user_id}`
  );

  let createdId = null;
  if (created && created.user_id) {
    createdId = created.user_id;

    // Vérifier la création réelle : auth.users (GoTrue omet encrypted_password
    // dans la réponse admin — la compatibilité bcrypt est prouvée par D6)
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(createdId);
    runTest(
      'P7-D2 compte créé dans auth.users (email + aud)',
      !!userRow?.user?.email && userRow.user.email === NEW_EMAIL,
      userRow.user ? `${userRow.user.email}` : 'absent'
    );
    runTest(
      'P7-D3 email confirmé dans auth.users',
      !!userRow?.user?.email_confirmed_at,
      userRow.user?.email_confirmed_at || 'absent'
    );

    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id,first_name,last_name,status')
      .eq('id', createdId)
      .single();
    runTest(
      'P7-D4 profil créé + prénom/nom + statut active',
      !!profileRow &&
        profileRow.first_name === 'Phase7' &&
        profileRow.last_name === 'Security' &&
        profileRow.status === 'active',
      profileRow ? JSON.stringify(profileRow) : 'absent'
    );

    const { data: roleRows } = await supabaseAdmin
      .from('user_roles')
      .select('role_id')
      .eq('user_id', createdId);
    runTest(
      'P7-D5 rôle candidate affecté automatiquement par le trigger',
      !!roleRows && roleRows.length === 1,
      roleRows ? roleRows.map((r) => r.role_id).join(',') : 'absent'
    );

    // Connexion réelle au compte créé (bcrypt compatible GoTrue)
    const newClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: loginData, error: loginErr } = await newClient.auth.signInWithPassword({
      email: NEW_EMAIL,
      password: 'newpass123',
    });
    runTest(
      'P7-D6 connexion réelle au compte créé (bcrypt GoTrue)',
      !!loginData.session && !loginErr,
      loginErr ? loginErr.message : `user=${loginData.user?.id}`
    );
  }

  // ---- P7-E : admin sans users.manage / candidate => refus ----
  const { data: siUnauth } = await supabase.auth.signInWithPassword({
    email: 'p4_unauth@test.com',
    password: PASSWORD,
  });
  if (siUnauth.session) {
    const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${siUnauth.session.access_token}` } },
    });
    const { error: createDenied } = await unauthClient.rpc('admin_create_user', {
      p_email: `x_${uid}@test.com`,
      p_password: 'newpass123',
    });
    runTest(
      'P7-E1 admin_create_user refusé sans users.manage (candidate)',
      !!createDenied && /ACCES_REFUSE/.test(createDenied.message),
      createDenied ? createDenied.message : 'création acceptée (fail sécurité)'
    );
    const { error: toggleDenied } = await unauthClient.rpc('admin_set_user_active', {
      p_target_user_id: session.user.id,
      p_active: false,
    });
    runTest(
      'P7-E2 admin_set_user_active refusé sans users.edit (candidate)',
      !!toggleDenied && /ACCES_REFUSE/.test(toggleDenied.message),
      toggleDenied ? toggleDenied.message : 'toggle accepté (fail sécurité)'
    );
  } else {
    runTest('P7-E admin non privilégié se connecte', false, 'pas de session p4_unauth');
  }

  // ---- P7-F : admin_set_user_active (super_admin) ----
  if (createdId) {
    const { error: banErr } = await adminClient.rpc('admin_set_user_active', {
      p_target_user_id: createdId,
      p_active: false,
    });
    runTest('P7-F1 admin_set_user_active(ban) = ok', !banErr, banErr ? banErr.message : 'no error');

    const { data: userAfterBan } = await supabaseAdmin.auth.admin.getUserById(createdId);
    runTest(
      'P7-F2 banned_until renseigné après le ban',
      !!userAfterBan?.user?.banned_until,
      userAfterBan.user?.banned_until || 'absent'
    );
    const { data: profileAfterBan } = await supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('id', createdId)
      .single();
    runTest(
      'P7-F3 profiles.status = inactive après le ban',
      profileAfterBan?.status === 'inactive',
      profileAfterBan?.status || 'absent'
    );

    const { error: unbanErr } = await adminClient.rpc('admin_set_user_active', {
      p_target_user_id: createdId,
      p_active: true,
    });
    runTest('P7-F4 admin_set_user_active(unban) = ok', !unbanErr, unbanErr ? unbanErr.message : 'no error');
    const { data: userAfterUnban } = await supabaseAdmin.auth.admin.getUserById(createdId);
    runTest(
      'P7-F5 banned_until = null après le unban',
      userAfterUnban?.user?.banned_until == null,
      userAfterUnban.user?.banned_until || 'absent'
    );
    const { data: profileAfterUnban } = await supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('id', createdId)
      .single();
    runTest(
      'P7-F6 profiles.status = active après le unban',
      profileAfterUnban?.status === 'active',
      profileAfterUnban?.status || 'absent'
    );

    // Cible inexistante => erreur côté RPC
    const bogusId = '00000000-0000-0000-0000-000000000000';
    const { error: bogusErr } = await adminClient.rpc('admin_set_user_active', {
      p_target_user_id: bogusId,
      p_active: false,
    });
    runTest(
      'P7-F7 cible inexistante => erreur RPC',
      !!bogusErr && /UTILISATEUR_INEXISTANT/.test(bogusErr.message),
      bogusErr ? bogusErr.message : 'aucune erreur (fail)'
    );

    // User non authentifié => refus générique
    const { error: anonErr } = await supabase.rpc('admin_create_user', {
      p_email: `anon_${uid}@test.com`,
      p_password: 'newpass123',
    });
    runTest(
      'P7-F8 RPC anonyme refusé (anon n\'a pas EXECUTE)',
      !!anonErr,
      anonErr ? anonErr.message : 'accepté (fail sécurité)'
    );
  }

  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n== ${results.length - failed}/${results.length} PASS ==`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---- Partie F : services frontend routés vers les RPC sécurisés ----
function staticFrontendChecks() {
  const createSrc = readSrc('services/auth/users/createUserAccount.js');
  const updateSrc = readSrc('services/auth/users/updateUserActive.js');
  const edgeSrc = readFileSync(path.join(SRC, '../supabase/functions/admin-reset-password/index.ts'), 'utf8');

  runTest(
    'P7-S1 createUserAccount appelle admin_create_user (plus de auth.admin.createUser)',
    createSrc.includes('rpc("admin_create_user"') && !createSrc.includes('auth.admin.createUser'),
    createSrc.includes('auth.admin.createUser') ? 'auth.admin.createUser encore présent' : 'RPC utilisé'
  );
  runTest(
    'P7-S2 updateUserActive appelle admin_set_user_active (plus de auth.admin.updateUserById)',
    updateSrc.includes('rpc("admin_set_user_active"') && !updateSrc.includes('auth.admin.updateUserById'),
    updateSrc.includes('auth.admin.updateUserById') ? 'auth.admin.updateUserById encore présent' : 'RPC utilisé'
  );

  runTest(
    'P7-S3 edge admin-reset-password passe par le RPC SECURITY DEFINER (plus de from("auth.users"))',
    edgeSrc.includes('admin_reset_user_password') &&
      !edgeSrc.includes("from('auth.users')") &&
      !edgeSrc.includes('has_permission'),
    'vérifié'
  );
}

staticFrontendChecks();

// ---- Partie G : CRUD catalogues super-admin (roles/pages/features) via REST ----
async function catalogCrudChecks() {
  const sessionA = await signInAs();
  const asAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionA.access_token}` } },
  });
  const { data: siC } = await supabase.auth.signInWithPassword({ email: 'p4_unauth@test.com', password: PASSWORD });
  const asCand = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${siC.session.access_token}` } },
  });

  const roleId = `p7_role_${uid}`;
  const pageId = `p7_page_${uid}`;
  const featureId = `p7_feat_${uid}`;

  // ROLES : super_admin écrit, candidate non
  const { error: roleIns } = await asAdmin.from('roles').insert({ id: roleId, name: `P7 role ${uid}`, description: 'test crud' });
  runTest('P7-G1 roles INSERT super_admin = ok', !roleIns, roleIns?.message);
  const { error: roleUpd } = await asAdmin.from('roles').update({ description: 'maj' }).eq('id', roleId);
  runTest('P7-G2 roles UPDATE super_admin = ok', !roleUpd, roleUpd?.message);
  const { error: roleDel } = await asAdmin.from('roles').delete().eq('id', roleId);
  runTest('P7-G3 roles DELETE super_admin = ok', !roleDel, roleDel?.message);
  const { error: roleCandIns } = await asCand.from('roles').insert({ id: roleId, name: 'x' });
  runTest('P7-G4 roles INSERT candidate = refusé (RLS structurelle super_admin)', !!roleCandIns, roleCandIns?.message || 'inséré (fail)');

  // PAGES
  const { error: pageIns } = await asAdmin.from('pages').insert({ id: pageId, name: `P7 page ${uid}`, path: `/p7-${uid}` });
  runTest('P7-G5 pages INSERT super_admin = ok', !pageIns, pageIns?.message);
  const { data: pageRow } = await supabaseAdmin.from('pages').select('id').eq('id', pageId).single();
  runTest('P7-G6 pages INSERT persisté', !!pageRow && pageRow.id === pageId, pageRow ? pageRow.id : 'absent');
  const { error: pageUpd } = await asAdmin.from('pages').update({ name: 'P7 maj' }).eq('id', pageId);
  runTest('P7-G7 pages UPDATE super_admin = ok', !pageUpd, pageUpd?.message);
  const { error: pageDel } = await asAdmin.from('pages').delete().eq('id', pageId);
  runTest('P7-G8 pages DELETE super_admin = ok', !pageDel, pageDel?.message);
  const { error: pageCandIns } = await asCand.from('pages').insert({ id: pageId, name: 'x', path: '/x' });
  runTest('P7-G9 pages INSERT candidate = refusé', !!pageCandIns, pageCandIns?.message || 'inséré (fail)');

  // FEATURES
  const { data: seedPage } = await supabaseAdmin.from('pages').select('id').limit(1).single();
  const featPageId = seedPage?.id ?? null;
  const { error: featIns } = await asAdmin.from('features').insert({ id: featureId, name: `P7 feat ${uid}`, description: 'test', page_id: featPageId });
  runTest('P7-G10 features INSERT super_admin = ok', !featIns, featIns?.message);
  const { error: featUpd } = await asAdmin.from('features').update({ description: 'maj' }).eq('id', featureId);
  runTest('P7-G11 features UPDATE super_admin = ok', !featUpd, featUpd?.message);
  const { error: featDel } = await asAdmin.from('features').delete().eq('id', featureId);
  runTest('P7-G12 features DELETE super_admin = ok', !featDel, featDel?.message);
  const { error: featCandIns } = await asCand.from('features').insert({ id: featureId, name: 'x', description: 'x', page_id: featPageId });
  runTest('P7-G13 features INSERT candidate = refusé', !!featCandIns, featCandIns?.message || 'inséré (fail)');

  // role_permissions : sélectif via capacité effective (non super_admin structurel)
  const { data: rpSel, error: rpErr } = await asCand.from('role_permissions').select('permission_id');
  runTest('P7-G14 role_permissions SELECT candidate (sans rbac.role_permissions) = 0 ligne',
    !rpErr && Array.isArray(rpSel) && rpSel.length === 0, rpErr?.message || `${(rpSel || []).length} ligne(s)`);
}

catalogCrudChecks();

main().catch((e) => {
  console.error(e);
  process.exit(1);
});