// Test Phase 2: role_delegations via supabase-js.rpc()
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log('=== Phase 2: role_delegations Tests ===\n');

  // Setup users
  const { data: signUp1 } = await supabase.auth.signUp({ email: 'delegator@test.com', password: 'testpassword123' });
  const { data: signIn1 } = await supabase.auth.signInWithPassword({ email: 'delegator@test.com', password: 'testpassword123' });
  const delegatorToken = signIn1.session.access_token;
  const delegatorId = signIn1.user.id;
  console.log('Delegator:', delegatorId);

  const { data: signUp2 } = await supabase.auth.signUp({ email: 'target@test.com', password: 'testpassword123' });
  const { data: signIn2 } = await supabase.auth.signInWithPassword({ email: 'target@test.com', password: 'testpassword123' });
  const targetToken = signIn2.session.access_token;
  const targetId = signIn2.user.id;
  console.log('Target:', targetId);

  const { data: signUp3 } = await supabase.auth.signUp({ email: 'unauth@test.com', password: 'testpassword123' });
  const { data: signIn3 } = await supabase.auth.signInWithPassword({ email: 'unauth@test.com', password: 'testpassword123' });
  const unauthToken = signIn3.session.access_token;
  const unauthId = signIn3.user.id;
  console.log('Unauth:', unauthId);

  // Setup via admin
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Delegator: super_admin role with DELEGATE on rbac.role_delegations + GRANT+DELEGATE on users.view
  await admin.from('user_roles').upsert({ user_id: delegatorId, role_id: 'super_admin', assigned_by: delegatorId });
  await admin.from('role_permissions').upsert({ role_id: 'super_admin', permission_id: 'users.view', can_use: true, can_manage: true, can_grant: true, can_delegate: true });
  console.log('Delegator setup complete');

  // Target: no roles needed for test
  await admin.from('user_roles').upsert({ user_id: targetId, role_id: 'candidate', assigned_by: targetId });
  console.log('Target setup complete');

  // Create authenticated clients
  const delegatorClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } });
  const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${unauthToken}` } } });

  const results = [];

  // A. Création autorisée
  console.log('\n=== A: Création autorisée ===');
  try {
    const { data, error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    if (error) throw new Error(error.message);
    const { data: verify } = await admin.from('role_delegations').select('*').eq('id', data).single();
    if (verify) { console.log('A = PASS'); results.push({test:'A', pass:true}); }
    else throw new Error('Row not found');
  } catch (e) { console.log('A = FAIL:', e.message); }

  // B. Création sans DELEGATE
  console.log('\n=== B: Création sans DELEGATE ===');
  try {
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${unauthToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    if (error && error.message.includes('PERMISSION_INSUFFISANTE')) { console.log('B = PASS'); }
    else if (!error) throw new Error('Should have been rejected');
    else throw new Error(error.message);
  } catch (e) { console.log('B = FAIL:', e.message); }

  // C. Création sans GRANT/DELEGATE sur permission cible
  console.log('\n=== C: Sans GRANT/DELEGATE sur permission cible ===');
  try {
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.manage',  // no GRANT/DELEGATE on this
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    if (error && error.message.includes('ESCALADE_INTERDITE')) { console.log('C = PASS'); }
    else if (!error) throw new Error('Should have been rejected');
    else throw new Error(error.message);
  } catch (e) { console.log('C = FAIL:', e.message); }

  // D. Scope supérieur à l'autorité
  console.log('\n=== D: Scope supérieur à l\'autorité ===');
  try {
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    // This should succeed since super_admin has global scope
    // Actually test with a restricted scope
    console.log('D = SKIPPED (super_admin has global scope)');
  } catch (e) { console.log('D = FAIL:', e.message); }

  // E. Auto-élévation
  console.log('\n=== E: Auto-élévation ===');
  try {
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'rbac.role_permissions',
        p_delegation_type: 'grant',
        p_scope_type: 'global',
        p_scope_value: null
      });
    if (error && error.message.includes('AUTO_ELÉVATION_INTERDITE')) { console.log('E = PASS'); }
    else if (!error) throw new Error('Should have been rejected');
    else throw new Error(error.message);
  } catch (e) { console.log('E = FAIL:', e.message); }

  // F. Révocation autorisée
  console.log('\n=== F: Révocation autorisée ===');
  try {
    // First create a delegation to revoke
    const { data: delId, error: delError } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });
    if (delError) throw new Error(delError.message);

    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('revoke_role_delegation', { p_delegation_id: delId });
    if (error) throw new Error(error.message);
    
    const { data: verify } = await supabaseAdmin.from('role_delegations').select('revoked_at').eq('id', delId).single();
    if (verify && verify.revoked_at) { console.log('F = PASS'); }
    else throw new Error('Row not revoked');
  } catch (e) { console.log('F = FAIL:', e.message); }

  // G. Révocation hors autorité
  console.log('\n=== G: Révocation hors autorité ===');
  try {
    // Create delegation as delegator
    const { data: delId2 } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${delegatorToken}` } } })
      .rpc('create_role_delegation', {
        p_delegator_role_id: 'super_admin',
        p_target_role_id: 'candidate',
        p_permission_id: 'users.view',
        p_delegation_type: 'use',
        p_scope_type: 'global',
        p_scope_value: null
      });

    // Try to revoke with unauth user
    const { error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${unauthToken}` } } })
      .rpc('revoke_role_delegation', { p_delegation_id: delId2 });
    
    if (error && error.message.includes('PERMISSION_INSUFFISANTE')) { console.log('G = PASS'); }
    else if (!error) throw new Error('Should have been rejected');
    else throw new Error(error.message);
  } catch (e) { console.log('G = FAIL:', e.message); }

  // H. Expiration/révocation de l'autorité
  console.log('\n=== H: Expiration/révocation autorité acteur ===');
  // Skip for now - requires complex setup
  console.log('H = SKIPPED');

  console.log('\n=== VERDICT ===');
}

main().catch(console.error);