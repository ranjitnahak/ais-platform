import { supabase } from './supabase';

/** Returns true if linked athlete has operational data rows. */
export async function userHasOperationalData(orgId, userEmail) {
  if (!userEmail) return false;
  try {
    const { data: athlete, error: athleteError } = await supabase
      .from('athletes')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', userEmail)
      .maybeSingle();
    if (athleteError) throw athleteError;
    if (!athlete?.id) return false;

    const athleteId = athlete.id;
    const tables = ['assessment_results', 'wellness_logs', 'session_athlete_logs'];
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId);
      if (error) throw error;
      if ((count ?? 0) > 0) return true;
    }
    return false;
  } catch (err) {
    console.error('[adminUserActions] userHasOperationalData', err);
    return true;
  }
}

export async function setUserActive(orgId, userId, isActive) {
  const patch = isActive
    ? { is_active: true, deactivated_at: null }
    : { is_active: false, deactivated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .eq('org_id', orgId);
  if (error) throw error;
}

export async function deleteUser(orgId, userId) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)
    .eq('org_id', orgId);
  if (error) throw error;
}
