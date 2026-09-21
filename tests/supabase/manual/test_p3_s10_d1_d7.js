// Test P3 S10: Alignement des divergences D1-D7 (rapport P3.8) sur l'autorité effective.
// Vraies autorités via RLS de la base locale + vrais JWT à 3 niveaux (candidate/admin/super_admin).
// Supabase local attendu sur http://127.0.0.1:54321
import { createClient } from '@supabase/supabase-js';

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

const makeClient = (token) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });

async function main() {
  console.log('=== P3 S10: Alignement D1-D7 sur autorité effective ===\n');

  // ---- Fixtures : super_admin, admin, candidat, cible ----
  const rnd = Date.now();
  const mk = (tag) => `p3s10_${tag}_${rnd}@test.com`;
  const userOf = async (email) => {
    const { data: su } = await supabase.auth.signUp({ email, password: 'testpassword123' });
    if (su.user?.id) {
      const { data: si } = await supabase.auth.signInWithPassword({ email, password: 'testpassword123' });
      return { id: si.user.id, token: si.session.access_token };
    }
    throw new Error(`signUp échoué pour ${email}`);
  };

  const superAdmin = await userOf(mk('sa'));
  const adminUser = await userOf(mk('admin'));
  const candidate = await userOf(mk('cand'));
  const target = await userOf(mk('target'));

  // Attribution des rôles via service (source de vérité = RPC côté production).
  // Ici on attache les rôles directement car c'est le setup de TEST (niveau système).
  await supabaseAdmin.from('user_roles').upsert({ user_id: superAdmin.id, role_id: 'super_admin', assigned_by: superAdmin.id });
  await supabaseAdmin.from('user_roles').upsert({ user_id: adminUser.id, role_id: 'admin', assigned_by: adminUser.id });
  await supabaseAdmin.from('user_roles').upsert({ user_id: candidate.id, role_id: 'candidate', assigned_by: candidate.id });
  await supabaseAdmin.from('user_roles').upsert({ user_id: target.id, role_id: 'candidate', assigned_by: target.id });

  // Rétablir l'état post-migration D7 : admin n'a AUCUNE capacité sur
  // rbac.role_assignability (sinon test_phase4 test M fausse D7.1/D7.2).
  await supabaseAdmin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'rbac.role_assignability', can_use: false, can_manage: false, can_grant: false, can_delegate: false });

  const asCandidate = makeClient(candidate.token);
  const asAdmin = makeClient(adminUser.token);
  const asSuperAdmin = makeClient(superAdmin.token);

  console.log('--- 1. D7: rbac.role_assignability retiré d\'admin (incohérent) ---\n');

  {
    // L'autorité effective d'admin ne doit plus contenir rbac.role_assignability
    const { data: eff, error: effErr } = await asAdmin.rpc('get_effective_authority', { p_user_id: adminUser.id });
    runTest('D7.1 admin n\'a plus rbac.role_assignability (autorité effective)', !effErr && !(eff || []).some((r) => r.permission_id === 'rbac.role_assignability' && r.capability === 'DELEGATE'), effErr?.message);
  }

  {
    // set_role_assignability doit être refusé pour admin (DELEGATE requis).
    // Paire non-auto (admin→super_admin) pour passer la validation et atteindre
    // le contrôle de permission.
    const { error } = await asAdmin.rpc('set_role_assignability', { p_assigner_role_id: 'admin', p_assignable_role_id: 'super_admin', p_allow: true });
    runTest('D7.2 admin refusé sur set_role_assignability', !!error && /PERMISSION_INSUFFISANTE/.test(error.message), error?.message);
  }

  {
    // super_admin conserve DELEGATE → autorisé (p_allow sur paire existante = no-op sûr)
    const { error } = await asSuperAdmin.rpc('set_role_assignability', { p_assigner_role_id: 'super_admin', p_assignable_role_id: 'admin', p_allow: true });
    runTest('D7.3 super_admin autorisé sur set_role_assignability', !error, error?.message);
  }

  {
    // La suppression de la permission ne casse PAS l'attribution (graphique + GRANT conservés)
    const { error } = await asAdmin.rpc('assign_user_role', { p_target_user_id: target.id, p_role_id: 'candidate', p_expires_at: null });
    runTest('D7.4 admin peut toujours assigner candidate (assign_user_role)', !error, error?.message);
  }

  console.log('\n--- 2. D1: catalogues (roles/permissions/pages/features/page_features) ---\n');

  {
    // Écriture catalogue refusée pour admin (politiques *_manage_admin supprimées)
    const { error } = await asAdmin.from('roles').insert({ id: 'p3s10_role_admin', name: 'T', description: 'test admin (doit échouer)', is_system: false });
    runTest('D1.1 admin ne peut pas insérer dans roles', !!error, error?.message);
    const { error: ePerm } = await asAdmin.from('permissions').insert({ id: 'p3s10_perm_admin', name: 'T', description: 'test admin', category: 'test' });
    runTest('D1.2 admin ne peut pas insérer dans permissions', !!ePerm, ePerm?.message);
  }

  {
    // super_admin peut écrire le catalogue (garde structurelle conservée)
    const { error: insErr } = await asSuperAdmin.from('roles').insert({ id: 'p3s10_role_tmp', name: 'TMP', description: 'test super (cleanup)', is_system: false });
    runTest('D1.3 super_admin peut insérer dans roles', !insErr, insErr?.message);
    if (!insErr) {
      const { error: delErr } = await supabaseAdmin.from('roles').delete().eq('id', 'p3s10_role_tmp');
      runTest('D1.4 nettoyage rôle temporaire', !delErr, delErr?.message);
    }
  }

  {
    // Lecture catalogue toujours ouverte (select_all conservée) pour le trafic UI
    const { data } = await asCandidate.from('roles').select('id').limit(1);
    runTest('D1.5 candidate peut lire roles (catalogue public)', Array.isArray(data) && data.length > 0, 'lecture OK');
  }

  console.log('\n--- 3. D2: RPC admin (admin_get_users / admin_reset_user_password) ---\n');

  {
    const { data, error } = await asAdmin.rpc('admin_get_users');
    runTest('D2.1 admin_get_users OK pour admin (users.view USE)', !error && Array.isArray(data), error?.message);
  }

  {
    const { data, error } = await asCandidate.rpc('admin_get_users');
    runTest('D2.2 admin_get_users refusé pour candidate', !!error || !Array.isArray(data), error?.message || 'aucune erreur = cas non géré');
  }

  {
    const { error } = await asAdmin.rpc('admin_reset_user_password', { target_user_id: target.id });
    runTest('D2.3 admin_reset_user_password OK pour admin (GRANT users.change_role user)', !error, error?.message);
  }

  {
    const { error } = await asCandidate.rpc('admin_reset_user_password', { target_user_id: target.id });
    runTest('D2.4 admin_reset_user_password refusé pour candidate', !!error, error?.message);
  }

  console.log('\n--- 4. D3: profiles (lecture/écriture par autorité effective) ---\n');

  {
    // admin (users.view) lit le profil d'autrui
    const { data, error } = await asAdmin.from('profiles').select('id').eq('id', target.id);
    runTest('D3.1 admin lit le profil de target (users.view)', !error && Array.isArray(data) && data.length > 0, error?.message || 'vide');
  }

  {
    // candidate ne voit pas le profil d'autrui (seulement le sien)
    const { data, error } = await asCandidate.from('profiles').select('id').eq('id', target.id);
    runTest('D3.2 candidate ne lit pas le profil d\'autrui', !error && Array.isArray(data) && data.length === 0, error?.message || 'ligne retournée');
  }

  {
    // candidate lit son propre profil
    const { data, error } = await asCandidate.from('profiles').select('id').eq('id', candidate.id);
    runTest('D3.3 candidate lit son propre profil', !error && Array.isArray(data) && data.length === 1, error?.message);
  }

  {
    // admin (users.edit) met à jour le profil d'autrui
    const { error } = await asAdmin.from('profiles').update({ first_name: 'P3S10Admin' }).eq('id', target.id);
    runTest('D3.4 admin met à jour le profil de target (users.edit)', !error, error?.message);
    const { data } = await supabaseAdmin.from('profiles').select('first_name').eq('id', target.id).single();
    runTest('D3.5 vérif écriture admin persistée', data?.first_name === 'P3S10Admin', JSON.stringify(data));
  }

  {
    // candidate ne modifie pas le profil d'autrui
    const { data, error } = await asCandidate.from('profiles').update({ status: 'archived' }).eq('id', target.id).select('id');
    runTest('D3.6 candidate ne modifie pas le profil d\'autrui', !error && Array.isArray(data) && data.length === 0, error?.message || JSON.stringify(data));
  }

  {
    // candidate modifie son propre profil (profile.edit USE + identité)
    const { error } = await asCandidate.from('profiles').update({ job_title: 'P3S10Cand' }).eq('id', candidate.id);
    runTest('D3.7 candidate modifie son propre profil (profile.edit)', !error, error?.message);
  }

  {
    // INSERT profiles refusé pour admin (plus de profiles_insert_admin ; création via trigger)
    const { error } = await asAdmin.from('profiles').insert({ id: adminUser.id, email: 'p3s10@test.com' });
    runTest('D3.8 admin ne peut pas insérer dans profiles (trigger seul)', !!error, error?.message);
  }

  console.log('\n--- 5. D4: user_roles (mutations = RPC ; SELECT par users.view) ---\n');

  {
    // INSERT via REST refusé (suppression des politiques INSERT/DELETE)
    const { error } = await asAdmin.from('user_roles').insert({ user_id: candidate.id, role_id: 'candidate', assigned_by: adminUser.id });
    runTest('D4.1 admin ne peut pas insérer user_roles via REST', !!error, error?.message);
  }

  {
    // DELETE via REST refusé : RLS sans politique DELETE ⇒ 0 ligne supprimée
    // (PostgREST renvoie succès sans erreur, mais la ligne reste présente).
    const { error } = await asAdmin.from('user_roles').delete().eq('user_id', candidate.id).eq('role_id', 'candidate');
    const { data: after } = await supabaseAdmin.from('user_roles').select('user_id').eq('user_id', candidate.id).eq('role_id', 'candidate');
    runTest('D4.2 admin ne peut pas supprimer user_roles via REST', !error && Array.isArray(after) && after.length > 0, error?.message || 'ligne supprimée à tort ou RLS non bloquant');
  }

  {
    // SELECT global par users.view (admin)
    const { data, error } = await asAdmin.from('user_roles').select('user_id, role_id').eq('user_id', target.id);
    runTest('D4.3 admin lit user_roles de target (users.view)', !error && Array.isArray(data) && data.length > 0, error?.message || 'vide');
  }

  {
    // SELECT own (candidate) conservé
    const { data, error } = await asCandidate.from('user_roles').select('user_id, role_id').eq('user_id', candidate.id);
    runTest('D4.4 candidate lit ses propres user_roles', !error && Array.isArray(data) && data.length > 0, error?.message || 'vide');
  }

  {
    // RPC reste la source de vérité : admin révoque candidate chez target
    const { error } = await asAdmin.rpc('revoke_user_role', { p_target_user_id: target.id, p_role_id: 'candidate' });
    runTest('D4.5 admin révoque candidate via revoke_user_role (RPC)', !error, error?.message);
  }

  console.log('\n--- 6. D5: role_permissions (lecture par rbac.role_permissions USE) ---\n');

  {
    // super_admin (rbac.role_permissions) lit role_permissions
    const { data, error } = await asSuperAdmin.from('role_permissions').select('permission_id').limit(1);
    runTest('D5.1 super_admin lit role_permissions (rbac.role_permissions)', !error && Array.isArray(data), error?.message);
  }

  {
    // admin n'a pas rbac.role_permissions → lecture vide sans erreur
    const { data, error } = await asAdmin.from('role_permissions').select('permission_id').limit(1);
    runTest('D5.2 admin ne lit pas role_permissions (rien, pas d\'erreur)', !error && Array.isArray(data) && data.length === 0, error?.message || JSON.stringify(data));
  }

  {
    // candidate non plus
    const { data, error } = await asCandidate.from('role_permissions').select('permission_id').limit(1);
    runTest('D5.3 candidate ne lit pas role_permissions', !error && Array.isArray(data) && data.length === 0, error?.message || JSON.stringify(data));
  }

  console.log('\n--- 7. D6: fonctionnel intact pour assign/revoke (autorité effective) ---\n');

  {
    // admin réattribue candidate pour laisser la base propre
    const { error } = await asAdmin.rpc('assign_user_role', { p_target_user_id: target.id, p_role_id: 'candidate', p_expires_at: null });
    runTest('D6.1 réattribution candidate restaurée', !error, error?.message);
    const { data } = await supabaseAdmin.from('user_roles').select('role_id').eq('user_id', target.id).eq('role_id', 'candidate');
    runTest('D6.2 vérif user_roles cible', Array.isArray(data) && data.length > 0, JSON.stringify(data));
  }

  // Nettoyage : targets de test restent en candidate (aucune donnée métier touchée).

  console.log('\n--- Synthèse ---');
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`P3-S10 : ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.log(`FAILS: ${failed.map((f) => f.name).join(', ')}`);
  }
}

main().catch((e) => {
  console.error('ERREUR FATALE:', e?.message || e);
});