// Test manuel pour diagnostiquer les problèmes

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  // Créer un utilisateur admin sans grant
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'test_manual_nogrant@test.com',
    password: 'testpassword123'
  });
  console.log('Signup:', signUpData?.user?.id, signUpError?.message);
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'test_manual_nogrant@test.com',
    password: 'testpassword123'
  });
  console.log('Signin:', signInData?.user?.id, signInError?.message);
  
  const token = signInData.session.access_token;
  console.log('Token:', token.substring(0, 50) + '...');
  
  // Attribuer le rôle admin via admin client
  const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient('http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const userId = signInData.user.id;
  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: userId, role_id: 'admin', assigned_by: userId });
  console.log('Assign role:', roleError?.message);
  
  // Test T4: UPDATE direct via REST API
  console.log('\n--- Test T4: UPDATE direct ---');
  const response = await fetch('http://127.0.0.1:54321/rest/v1/role_permissions?role_id=eq.admin&permission_id=eq.users.view', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ can_grant: true })
  });
  
  const result = await response.json().catch(() => ({}));
  console.log('Status:', response.status);
  console.log('Result:', result);
}

test().catch(console.error);