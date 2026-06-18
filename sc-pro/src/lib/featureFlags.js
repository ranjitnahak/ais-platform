import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './auth.js'

export async function isFeatureEnabled(featureKey) {
  try {
    const user = await getCurrentUser()
    if (!user) return false
    const { data, error } = await supabase
      .from('org_feature_flags')
      .select('is_enabled')
      .eq('org_id', user.orgId)
      .eq('feature_key', featureKey)
      .single()
    if (error) throw error
    return data?.is_enabled ?? false
  } catch {
    return false
  }
}

export async function isBundleActive() {
  try {
    const [ais, scPro] = await Promise.all([
      isFeatureEnabled('periodisation'),
      isFeatureEnabled('sc_pro')
    ])
    return ais && scPro
  } catch {
    return false
  }
}
