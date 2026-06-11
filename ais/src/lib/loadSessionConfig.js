import {
  DEFAULT_SESSION_CONFIG_ORG_ID,
  SESSION_TYPE_SELECT,
  SESSION_VENUE_SELECT,
} from './sessionConfigConstants';

function buildTypeQuery(supabase, orgId, includeInactive) {
  let query = supabase
    .from('session_type_options')
    .select(SESSION_TYPE_SELECT)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  return query;
}

function buildVenueQuery(supabase, orgId, includeInactive) {
  let query = supabase
    .from('session_venue_options')
    .select(SESSION_VENUE_SELECT)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  return query;
}

/** Load active session types for an org; fall back to default template org. */
export async function loadSessionTypeOptions(supabase, orgId, { includeInactive = false } = {}) {
  if (!orgId) return [];

  const { data: orgRows, error: orgError } = await buildTypeQuery(supabase, orgId, includeInactive);
  if (orgError) throw orgError;
  if ((orgRows ?? []).length > 0) return orgRows ?? [];

  if (orgId === DEFAULT_SESSION_CONFIG_ORG_ID) return [];

  const { data: templateRows, error: templateError } = await buildTypeQuery(
    supabase,
    DEFAULT_SESSION_CONFIG_ORG_ID,
    includeInactive,
  );
  if (templateError) throw templateError;
  return templateRows ?? [];
}

/** Load active venues for an org; fall back to default template org. */
export async function loadSessionVenueOptions(supabase, orgId, { includeInactive = false } = {}) {
  if (!orgId) return [];

  const { data: orgRows, error: orgError } = await buildVenueQuery(supabase, orgId, includeInactive);
  if (orgError) throw orgError;
  if ((orgRows ?? []).length > 0) return orgRows ?? [];

  if (orgId === DEFAULT_SESSION_CONFIG_ORG_ID) return [];

  const { data: templateRows, error: templateError } = await buildVenueQuery(
    supabase,
    DEFAULT_SESSION_CONFIG_ORG_ID,
    includeInactive,
  );
  if (templateError) throw templateError;
  return templateRows ?? [];
}

/** Load all session types for admin (includes inactive); no fallback merge. */
export async function loadSessionTypeOptionsAdmin(supabase, orgId) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from('session_type_options')
    .select(SESSION_TYPE_SELECT)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Load all venues for admin (includes inactive); no fallback merge. */
export async function loadSessionVenueOptionsAdmin(supabase, orgId) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from('session_venue_options')
    .select(SESSION_VENUE_SELECT)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Copy default template session config into target org (skip existing keys/labels). */
export async function copyDefaultSessionConfig(supabase, targetOrgId) {
  const { data: templateTypes, error: typeLoadError } = await supabase
    .from('session_type_options')
    .select('key, label, sort_order, is_active, default_venue')
    .eq('org_id', DEFAULT_SESSION_CONFIG_ORG_ID)
    .order('sort_order', { ascending: true });
  if (typeLoadError) throw typeLoadError;

  const { data: templateVenues, error: venueLoadError } = await supabase
    .from('session_venue_options')
    .select('label, sort_order, is_active')
    .eq('org_id', DEFAULT_SESSION_CONFIG_ORG_ID)
    .order('sort_order', { ascending: true });
  if (venueLoadError) throw venueLoadError;

  if (!templateTypes?.length && !templateVenues?.length) {
    throw new Error('Default session config template not found.');
  }

  if (templateTypes?.length) {
    const typeRows = templateTypes.map((row) => ({
      ...row,
      org_id: targetOrgId,
    }));
    const { error: typeInsertError } = await supabase
      .from('session_type_options')
      .upsert(typeRows, { onConflict: 'org_id,key', ignoreDuplicates: true });
    if (typeInsertError) throw typeInsertError;
  }

  if (templateVenues?.length) {
    const venueRows = templateVenues.map((row) => ({
      ...row,
      org_id: targetOrgId,
    }));
    const { error: venueInsertError } = await supabase
      .from('session_venue_options')
      .upsert(venueRows, { onConflict: 'org_id,label', ignoreDuplicates: true });
    if (venueInsertError) throw venueInsertError;
  }
}

/** Map DB rows to { label, value } for dropdowns. */
export function toSessionTypeDropdownOptions(rows) {
  return (rows ?? []).map((row) => ({ label: row.label, value: row.key }));
}

/** Map DB venue rows to label strings for dropdowns. */
export function toVenueDropdownOptions(rows) {
  return (rows ?? []).map((row) => row.label);
}
