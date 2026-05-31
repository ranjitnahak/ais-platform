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
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .eq('org_id', orgId)
    .select('id');
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Update was blocked by permissions or the user no longer exists.');
  }
}

/** Remove or detach rows that reference users.id without ON DELETE CASCADE/SET NULL. */
async function clearUserDeleteBlockers(orgId, userId) {
  // Notes may use a legacy org_id that differs from users.org_id — scope by author only.
  const { error: notesErr } = await supabase
    .from('athlete_staff_notes')
    .delete()
    .eq('author_id', userId);
  if (notesErr) throw notesErr;
  const { count: remainingNotes, error: notesCountErr } = await supabase
    .from('athlete_staff_notes')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId);
  if (notesCountErr) throw notesCountErr;
  if ((remainingNotes ?? 0) > 0) {
    throw new Error('Could not remove linked staff notes (permissions). Try again as superuser or deactivate the user.');
  }

  const steps = [
    // assessment_results has entered_by but no org_id — scope via user id only
    { id: 'assessment_results', run: () => supabase.from('assessment_results').update({ entered_by: null }).eq('entered_by', userId) },
    { id: 'assessment_sessions', run: () => supabase.from('assessment_sessions').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'periodisation_plans', run: () => supabase.from('periodisation_plans').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'plan_cells', run: () => supabase.from('plan_cells').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'plan_templates', run: () => supabase.from('plan_templates').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'sessions', run: () => supabase.from('sessions').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'session_library_items', run: () => supabase.from('session_library_items').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'athlete_reports', run: () => supabase.from('athlete_reports').update({ generated_by: null }).eq('generated_by', userId).eq('org_id', orgId) },
    { id: 'team_reports', run: () => supabase.from('team_reports').update({ generated_by: null }).eq('generated_by', userId).eq('org_id', orgId) },
    { id: 'athletes', run: () => supabase.from('athletes').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'camps', run: () => supabase.from('camps').update({ created_by: null }).eq('created_by', userId).eq('org_id', orgId) },
    { id: 'org_feature_flags', run: () => supabase.from('org_feature_flags').update({ enabled_by: null }).eq('enabled_by', userId).eq('org_id', orgId) },
    { id: 'report_access_grants_to', run: () => supabase.from('report_access_grants').delete().eq('granted_to', userId).eq('org_id', orgId) },
    { id: 'report_access_grants_by', run: () => supabase.from('report_access_grants').delete().eq('granted_by', userId).eq('org_id', orgId) },
    { id: 'user_permission_overrides_created', run: () => supabase.from('user_permission_overrides').update({ created_by: null }).eq('created_by', userId) },
    { id: 'audit_log', run: () => supabase.from('audit_log').delete().eq('user_id', userId) },
  ];
  for (const step of steps) {
    const { error } = await step.run();
    if (error) throw error;
  }
}

export function formatDeleteUserError(err) {
  const msg = String(err?.message ?? '');
  if (err?.code === '23503') {
    return 'This user is still linked to other records. Try deactivating instead, or contact support.';
  }
  if (msg.includes('blocked by permissions')) {
    return 'Delete was blocked by permissions or the user no longer exists.';
  }
  return msg || 'Could not delete user.';
}

export async function deleteUser(orgId, userId) {
  await clearUserDeleteBlockers(orgId, userId);
  const { data, error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)
    .eq('org_id', orgId)
    .select('id');
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Delete was blocked by permissions or the user no longer exists.');
  }
}
