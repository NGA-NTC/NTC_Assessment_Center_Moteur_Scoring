// Test T2/T3 with supabase-js rpc() - corrected grant_role_permission
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log('=== T2/T3 Validation via supabase-js rpc() ===\n');

  // T2: User WITH grants
  const { data: signUp1 } = await supabase.auth.signUp({ email: 't2_test@test.com', password: 'testpassword123' });
  const { data: signIn1 } = await supabase.auth.signInWithPassword({ email: 't2_test@test.com', password: 'testpassword123' });
  const t2_token = signIn1.session.access_token;
  const t2_userId = signIn1.user.id;
  console.log('T2 user:', t2_userId);

  // T3: User WITHOUT grants  
  const { data: signUp2 } = await supabase.auth.signUp({ email: 't3_test@test.com', password: 'testpassword123' });
  const { data: signIn2 } = await supabase.auth.signInWithPassword({ email: 't3_test@test.com', password: 'testpassword123' });
  const t3_token = signIn2.session.access_token;
  const t3_userId = signIn2.user.id;
  console.log('T3 user:', t3_userId);

  // Setup via admin
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  
  // T2 user: admin role + GRANT on rbac.role_permissions + GRANT on users.edit
  await admin.from('user_roles').upsert({ user_id: t2_userId, role_id: 'admin', assigned_by: t2_userId });
  await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'rbac.role_permissions', can_use: true, can_manage: true, can_grant: true, can_delegate: true });
  await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'users.edit', can_use: true, can_manage: true, can_grant: true, can_delegate: true });
  console.log('T2 user setup complete');

  // T3 user: no_grant_admin role only (NO grants on rbac.role_permissions)
  await admin.from('user_roles').delete().eq('user_id', t3_userId).eq('role_id', 'admin');
  await admin.from('user_roles').upsert({ user_id: t3_userId, role_id: 'no_grant_admin', assigned_by: t3_userId });
  console.log('T3 user setup complete');

  // Create authenticated clients
  const t2_client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${t2_token}` } } });
  const t3_client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${t3_token}` } } });

  // ===== T2 TEST =====
  console.log('\n=== T2: grant_role_permission WITH grants ===');
  try {
    const { data: t2_data, error: t2_error } = await t2_client.rpc('grant_role_permission', {
      p_target_role_id: 'admin',
      p_permission_id: 'users.edit',
      p_capabilities: { use: true, manage: false, grant: false, delegate: false },
      p_scope_type: 'global',
      p_scope_value: null
    });
    
    if (t2_error) {
      console.log('T2 = FAIL');
      console.log('Error:', t2_error.message);
    } else {
      // Verify in DB
      const { data: verify, error: verifyError } = await supabaseAdmin.from('role_permissions').select('*').eq('role_id', 'admin').eq('permission_id', 'users.edit').single();
      if (verify && verify.can_use) {
        console.log('T2 = PASS');
        console.log('Proof: RPC succeeded, row created/updated in role_permissions');
      } else {
        console.log('T2 = FAIL');
        console.log('Error: RPC succeeded but row not found');
      }
    }
  } catch (e) {
    console.log('T2 = FAIL');
    console.log('Error:', e.message);
  }

  // ===== T3 TEST =====
  console.log('\n=== T3: grant_role_permission WITHOUT grants ===');
  try {
    const { error: t3_error } = await t3_client.rpc('grant_role_permission', {
      p_target_role_id: 'admin',
      p_permission_id: 'users.view',
      p_capabilities: { use: true, manage: false, grant: false, delegate: false },
      p_scope_type: 'global',
      p_scope_value: null
    });
    
    if (t3_error && t3_error.message.includes('PERMISSION_INSUFFISANTE')) {
      console.log('T3 = PASS');
      console.log('Proof: RPC rejected with:', t3_error.message);
    } else if (!t3_error) {
      console.log('T3 = FAIL');
      console.log('Error: RPC should have been rejected but succeeded');
    } else {
      console.log('T3 = FAIL');
      console.log('Error:', t3_error?.message);
    }
  } catch (e) {
    console.log('T3 = FAIL');
    console.log('Error:', e.message);
  }

  console.log('\n=== VERDICT ===');
}

main().catch(console.error);