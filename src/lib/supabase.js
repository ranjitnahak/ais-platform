import { createClient } from '@supabase/supabase-js';

// NOTE: RLS is disabled on all tables for development.
// To re-enable, run in Supabase SQL editor:
//   ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE test_definitions ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
//   ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
