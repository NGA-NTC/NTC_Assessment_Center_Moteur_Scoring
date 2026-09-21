// Test ciblé P4.2c: Stabilisation frontend
//  - Les 3 titres i18n (pages.*.title) résolvent via t() (plus de clés brutes)
//  - Les requêtes alimentant /super-admin (stats) fonctionnent avec des colonnes valides
//    (role_permissions n'a pas de colonne id) et renvoient des comptages réels.
// Supabase local attendu sur http://127.0.0.1:54321
import { createClient } from '@supabase/supabase-js';
import { t } from '../../../src/i18n/index.js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const results = [];
function runTest(name, cond, detail) {
  const status = cond ? 'PASS' : 'FAIL';
  results.push({ name, status });
  console.log(`${name} = ${status}${cond && detail ? ' (' + detail + ')' : ''}${!cond ? ' -> ' + detail : ''}`);
}

async function main() {
  // ---- Partie 1 : résolution i18n des 3 titres super-admin ----
  const expectations = [
    ['pages.accessControl.title', 'Accès'],
    ['pages.pages.title', 'Pages'],
    ['pages.fonctionnalites.title', 'Fonctionnalités'],
    ['pages.tableauDeBord.title', 'Tableau de bord Super Admin'],
  ];
  for (const [key, expected] of expectations) {
    runTest(`i18n: ${key} résolu`, t(key) === expected, t(key));
  }
  const rawKeys = expectations.filter(([key]) => t(key) === key);
  runTest('i18n: aucune clé brute affichée', rawKeys.length === 0, rawKeys.join(', ') || 'toutes résolues');
  runTest('i18n: clé inconnue = repli clé brute', t('pages.inconnue.title') === 'pages.inconnue.title', t('pages.inconnue.title'));
  runTest('i18n: t() sans clé = chaîne vide', t(null) === '', String(t(null)));

  // ---- Partie 2 : forage des stats dashboard (colonnes valides) ----
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await supabase.auth.signInWithPassword({ email: 'p4_admin@test.com', password: 'testpassword123' });
  if (!auth?.session) throw new Error('connexion p4_admin impossible');
  const sc = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } } });

  const [usersRes, rolesRes, pagesRes, featuresRes, rpRes] = await Promise.all([
    sc.rpc('admin_get_users'),
    sc.from('roles').select('*').order('id'),
    sc.from('pages').select('*'),
    sc.from('features').select('*'),
    sc.from('role_permissions').select('role_id').order('permission_id'),
  ]);

  for (const [label, res] of [
    ['users', usersRes], ['roles', rolesRes], ['pages', pagesRes], ['features', featuresRes], ['role_permissions', rpRes],
  ]) {
    runTest(`stats: ${label} sans erreur`, !res.error, res.error?.message || `${(res.data || []).length}` );
  }
  runTest('stats: users > 0', (usersRes.data || []).length > 0, `${(usersRes.data || []).length}`);
  runTest('stats: roles > 0', (rolesRes.data || []).length > 0, `${(rolesRes.data || []).length}`);
  runTest('stats: pages > 0', (pagesRes.data || []).length > 0, `${(pagesRes.data || []).length}`);
  runTest('stats: features > 0', (featuresRes.data || []).length > 0, `${(featuresRes.data || []).length}`);
  runTest('stats: règles d\'accès > 0', (rpRes.data || []).length > 0, `${(rpRes.data || []).length}`);

  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(`\n${results.length - fails.length}/${results.length} assertions PASS`);
  if (fails.length > 0) {
    console.error('ÉCHEC:', fails.map((f) => f.name).join(', '));
  }
}

main().catch((e) => { console.error('Erreur:', e.message); });