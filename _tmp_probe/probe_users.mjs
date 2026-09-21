import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: sess } = await supabase.auth.signInWithPassword({ email: 'p4_admin@test.com', password: 'testpassword123' });
const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } } });
const { data, error } = await adminClient.rpc('admin_get_users');
if (error) { console.log('ERR', error.message); process.exit(0); }
const rows = data || [];
console.log('count', rows.length);
if (rows[0]) console.log('keys', Object.keys(rows[0]).join(','));
console.log('sample user_fields', JSON.stringify(rows[0]));

