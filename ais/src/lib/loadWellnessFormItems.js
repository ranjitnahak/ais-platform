import {
  DEFAULT_WELLNESS_TEMPLATE_ORG_ID,
  WELLNESS_FORM_ITEM_SELECT,
} from './wellnessFormConstants';

/** Load active wellness form items for an org; fall back to default template org. */
export async function loadWellnessFormItems(supabase, orgId, { includeInactive = false } = {}) {
  if (!orgId) return [];

  const buildQuery = (targetOrgId) => {
    let query = supabase
      .from('wellness_form_items')
      .select(WELLNESS_FORM_ITEM_SELECT)
      .eq('org_id', targetOrgId)
      .order('sort_order', { ascending: true });
    if (!includeInactive) query = query.eq('is_active', true);
    return query;
  };

  const { data: orgItems, error: orgError } = await buildQuery(orgId);
  if (orgError) throw orgError;
  if ((orgItems ?? []).length > 0) return orgItems ?? [];

  if (orgId === DEFAULT_WELLNESS_TEMPLATE_ORG_ID) return [];

  const { data: templateItems, error: templateError } = await buildQuery(DEFAULT_WELLNESS_TEMPLATE_ORG_ID);
  if (templateError) throw templateError;
  return templateItems ?? [];
}

/** Load all items for admin (includes inactive); no fallback merge. */
export async function loadWellnessFormItemsAdmin(supabase, orgId) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from('wellness_form_items')
    .select(WELLNESS_FORM_ITEM_SELECT)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function loadWellnessThresholds(supabase, orgId) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from('wellness_thresholds')
    .select('id, item_key, threshold')
    .eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}

/** Copy default template items into target org (skip existing keys). */
export async function copyDefaultWellnessTemplate(supabase, targetOrgId) {
  const { data: templateItems, error: loadError } = await supabase
    .from('wellness_form_items')
    .select('key, label, label_translations, input_type, scale_min, scale_max, scale_min_label, scale_max_label, options, direction, sort_order, is_required, is_active')
    .eq('org_id', DEFAULT_WELLNESS_TEMPLATE_ORG_ID)
    .order('sort_order', { ascending: true });
  if (loadError) throw loadError;
  if (!templateItems?.length) throw new Error('Default wellness template not found.');

  const rows = templateItems.map((item) => ({
    ...item,
    org_id: targetOrgId,
  }));

  const { error: insertError } = await supabase
    .from('wellness_form_items')
    .upsert(rows, { onConflict: 'org_id,key', ignoreDuplicates: true });
  if (insertError) throw insertError;

  const { data: templateThresholds, error: thresholdLoadError } = await supabase
    .from('wellness_thresholds')
    .select('item_key, threshold')
    .eq('org_id', DEFAULT_WELLNESS_TEMPLATE_ORG_ID);
  if (thresholdLoadError) throw thresholdLoadError;

  if (templateThresholds?.length) {
    const thresholdRows = templateThresholds.map((row) => ({
      org_id: targetOrgId,
      item_key: row.item_key,
      threshold: row.threshold,
    }));
    const { error: thresholdInsertError } = await supabase
      .from('wellness_thresholds')
      .upsert(thresholdRows, { onConflict: 'org_id,item_key', ignoreDuplicates: true });
    if (thresholdInsertError) throw thresholdInsertError;
  }
}
