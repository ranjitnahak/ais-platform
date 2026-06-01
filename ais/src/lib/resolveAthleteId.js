import { supabase } from './supabase'

/** Resolve athletes.id for the logged-in portal user (never users.id). */
export async function resolveAthleteId(currentUser, effectiveOrgId) {
  if (currentUser?.athleteId) return currentUser.athleteId

  const { data: sessionData } = await supabase.auth.getSession()
  const authUid = sessionData?.session?.user?.id
  if (!authUid) return null

  const { data: athlete, error } = await supabase
    .from('athletes')
    .select('id')
    .eq('org_id', effectiveOrgId)
    .eq('auth_id', authUid)
    .maybeSingle()
  if (error) throw error
  return athlete?.id ?? null
}
