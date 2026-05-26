import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export async function isFeatureEnabled(featureKey) {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('org_feature_flags')
      .select('is_enabled')
      .eq('org_id', user.orgId)
      .eq('feature_key', featureKey)
      .single();
    if (error) throw error;
    return data?.is_enabled ?? false;
  } catch {
    return false;
  }
}

export const featureFlags = {
  wellness: () => isFeatureEnabled('wellness'),
  rpeLogging: () => isFeatureEnabled('rpe_logging'),
  unifiedReports: () => isFeatureEnabled('unified_reports'),
  aiAssistant: () => isFeatureEnabled('ai_assistant'),
  injurySurveillance: () => isFeatureEnabled('injury_surveillance'),
};
