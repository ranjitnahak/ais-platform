import { createClient } from '@supabase/supabase-js';
import { redirectAuthCallbackToResetPassword } from './authRedirect';

// NOTE: RLS may be enabled in Supabase. Superuser cross-org reads require
// ais/sql/superuser_cross_org_rls_v1.sql applied on the project.
// To re-enable, run in Supabase SQL editor:
//   ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE test_definitions ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

redirectAuthCallbackToResetPassword();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Handle recovery/invite hash tokens in ResetPassword only — avoids consuming
    // tokens on `/` before our redirect logic can forward them to /reset-password.
    detectSessionInUrl: false,
  },
});
