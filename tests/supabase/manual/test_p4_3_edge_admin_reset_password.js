// Smoketest edge admin-reset-password (réal JWT via Kong)
// 1) super_admin : cible existante => 200 (autorité GRANT users.change_role validée
//    par le RPC SECURITY DEFINER — plus de has_permission legacy ni de from('auth.users'))
// 2) candidate : => 403
/* global process, Buffer */
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(URL, ANON);

async function callEdge(token, target) {
  const res = await fetch(`${URL}/functions/v1/admin-reset-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target_user_id: target }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  const { data: adminSession } = await supabase.auth.signInWithPassword({
    email: 'p4_admin@test.com',
    password: 'testpassword123',
  });
  const { data: candSession } = await supabase.auth.signInWithPassword({
    email: 'p4_target@test.com',
    password: 'testpassword123',
  });

  let failed = 0;
  if (!adminSession) { failed++; console.log('FAIL admin login'); }
  if (!candSession) { failed++; console.log('FAIL candidate login'); }
  if (!adminSession || !candSession) return;
  const dr = (t) => { const p = t.split('.')[1]; return p && JSON.parse(Buffer.from(p, 'base64').toString()).sub; };
  console.log('DIAG admin sub =', dr(adminSession.session.access_token), 'cand sub =', dr(candSession.session.access_token));

  // 1) super_admin vers cible candidate existante
  const okRes = await callEdge(adminSession.session.access_token, candSession.user.id);
  console.log(`EDGE-D1 super_admin/cible existante = ${okRes.status === 200 ? 'PASS' : 'FAIL'} (status ${okRes.status}) ${JSON.stringify(okRes.body)}`);
  if (okRes.status !== 200) failed++;

  // 2) candidate (sans GRANT users.change_role sur cette cible) => 403
  const deniedRes = await callEdge(candSession.session.access_token, adminSession.user.id);
  console.log(`EDGE-E1 candidate/cible admin = ${deniedRes.status === 403 ? 'PASS' : 'FAIL'} (status ${deniedRes.status}) ${JSON.stringify(deniedRes.body)}`);
  if (deniedRes.status !== 403) failed++;

  // 3) candidate cible inexistante => 403 (RPC raise)
  const bogusRes = await callEdge(candSession.session.access_token, '00000000-0000-0000-0000-000000000000');
  console.log(`EDGE-E2 candidate/cible inexistante = ${bogusRes.status === 403 ? 'PASS' : 'FAIL'} (status ${bogusRes.status}) ${JSON.stringify(bogusRes.body)}`);
  if (bogusRes.status !== 403) failed++;

  // 4) token invalide => 401
  const badRes = await callEdge('not-a-token', candSession.user.id);
  console.log(`EDGE-E3 token invalide = ${badRes.status === 401 ? 'PASS' : 'FAIL'} (status ${badRes.status}) ${JSON.stringify(badRes.body)}`);
  if (badRes.status !== 401) failed++;

  console.log(failed === 0 ? '\n== 4/4 PASS ==' : `\n== ${4 - failed}/4 PASS ==`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });