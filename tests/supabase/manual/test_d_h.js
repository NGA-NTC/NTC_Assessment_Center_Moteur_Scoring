// Test D & H for Phase 2
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log('=== Phase 2: D & H Tests ===\n');

  // D: Scope supérieur
  console.log('=== D: Scope supérieur ===');
  try {
    // Create user with role scope only (no global)
    const { data: signUp } = await supabase.auth.signUp({ email: 'scope_test@test.com', password: 'testpassword123' });
    const { data: signIn } = await supabase.auth.signInWithPassword({ email: 'scope_test@test.com', password: 'testpassword123' });
    const userId = signIn.user.id;
    const token = signIn.session.access_token;
    console.log('User:', userId);

    // Assign admin role (but only role scope via delegation setup)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    await admin.from('user_roles').upsert({ user_id: userId, role_id: 'admin', assigned_by: userId });
    
    // Give admin GRANT/DELEGATE on users.view but NOT on rbac.role_delegations
    await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'users.view', can_use: true, can_manage: true, can_grant: true, can_delegate: true });
    // NO rbac.role_delegations grant for admin role

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });

    // Try to create delegation with global scope - should fail because admin role doesn't have DELEGATE on rbac.role_delegations
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    
    if (error && error.message.includes('PERMISSION_INSUFFISANTE')) {
      console.log('D = PASS');
    } else if (!error) {
      console.log('D = FAIL: Should have been rejected');
    } else {
      console.log('D = FAIL:', error.message);
    }
  } catch (e) { console.log('D = FAIL:', e.message); }

  // H: Expiration/révocation
  console.log('\n=== H: Expiration/révocation autorité ===');
  try {
    // Create user with expired role
    const { data: signUp } = await supabase.auth.signUp({ email: 'expired_test@test.com', password: 'testpassword123' });
    const { data: signIn } = await supabase.auth.signInWithPassword({ email: 'expired_test@test.com', password: 'testpassword123' });
    const userId = signIn.user.id;
    const token = signIn.session.access_token;
    console.log('User:', userId);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    
    // Assign admin role with expiration in the past
    await admin.from('user_roles').upsert({ 
      user_id: userId, 
      role_id: 'admin', 
      assigned_by: userId,
      expires_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    });
    
    // Give admin all needed grants
    await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'rbac.role_delegations', can_use: true, can_manage: true, can_grant: true, can_delegate: true });
    await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'users.view', can_use: true, can_manage: true, can_grant: true, can_delegate: true });

    // Try to create delegation - should fail due to expired role
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    
    if (error && error.message.includes('PERMISSION_INSUFFISANTE')) {
      console.log('H = PASS');
    } else if (!error) {
      console.log('H = FAIL: Should have been rejected');
    } else {
      console.log('H = FAIL:', error.message);
    }
  } catch (e) { console.log('H = FAIL:', e.message); }

  // Test revoked role
  console.log('\n=== H (revoked): Révocation rôle ===');
  try {
    const { data: signUp } = await supabase.auth.signUp({ email: 'revoked_test@test.com', password: 'testpassword123' });
    const { data: signIn } = await supabase.auth.signInWithPassword({ email: 'revoked_test@test.com', password: 'testpassword123' });
    const userId = signIn.user.id;
    const token = signIn.session.access_token;
    console.log('User:', userId);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    
    // Assign admin role then revoke it
    await admin.from('user_roles').upsert({ 
      user_id: userId, 
      role_id: 'admin', 
      assigned_by: userId,
      revoked_at: new Date().toISOString()
    });
    
    // Give admin all needed grants
    await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'rbac.role_delegations', can_use: true, can_manage: true, can_grant: true, can_delegate: true });
    await admin.from('role_permissions').upsert({ role_id: 'admin', permission_id: 'users.view', can_use: true, can_manage: true, can_grant: true, can_delegate: true });

    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    
    if (error && error.message.includes('PERMISSION_INSUFFISANTE')) {
      console.log('H (revoked) = PASS');
    } else if (!error) {
      console.log('H (revoked) = FAIL: Should have been rejected');
    } else {
      console.log('H (revoked) = FAIL:', error.message);
    }
  } catch (e) { console.log('H (revoked) = FAIL:', e.message); }
}

main().catch(console.error);