/** Supabase helpers for exercise_categories / exercise_tags (S&C Pro taxonomy). */

const CATEGORY_FIELDS = 'id, name, type, sort_order, parent_id'

function sortBySortOrder(a, b) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
}

function dedupeById(rows) {
  const m = new Map()
  for (const r of rows) {
    if (r?.id && !m.has(r.id)) m.set(r.id, r)
  }
  return [...m.values()].sort(sortBySortOrder)
}

async function fetchCategoriesByType(supabase, type, orgId, regionId = null) {
  // Omit is_active — seeded system rows often have is_active NULL/false and would vanish with .eq(true).
  const visibilityOr = `and(type.eq.${type},org_id.is.null),and(type.eq.${type},org_id.eq.${orgId})`
  let q = supabase
    .from('exercise_categories')
    .select(CATEGORY_FIELDS)
    .or(visibilityOr)
    .order('sort_order', { ascending: true })
  if (regionId) q = q.eq('parent_id', regionId)

  let { data, error } = await q
  if (error) {
    let q2 = supabase
      .from('exercise_categories')
      .select(CATEGORY_FIELDS)
      .eq('type', type)
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .order('sort_order', { ascending: true })
    if (regionId) q2 = q2.eq('parent_id', regionId)
    const r2 = await q2
    if (r2.error) throw r2.error
    return dedupeById(r2.data ?? [])
  }
  return dedupeById(data ?? [])
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} orgId
 * @returns {Promise<Array<{ id: string, name: string, type: string, sort_order: number, parent_id: string | null }>>}
 */
export async function fetchRegions(supabase, orgId) {
  return fetchCategoriesByType(supabase, 'region', orgId)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} orgId
 * @param {string | null} [regionId]
 */
export async function fetchPatterns(supabase, orgId, regionId = null) {
  return fetchCategoriesByType(supabase, 'pattern', orgId, regionId)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} orgId
 */
export async function fetchTags(supabase, orgId) {
  return fetchCategoriesByType(supabase, 'tag', orgId)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} exerciseId
 * @returns {Promise<Array<{ category_id: string, name: string }>>}
 */
export async function fetchExerciseTags(supabase, exerciseId) {
  const { data, error } = await supabase
    .from('exercise_tags')
    .select('category_id, exercise_categories(id, name)')
    .eq('exercise_id', exerciseId)
  if (error) throw error
  const out = []
  for (const row of data ?? []) {
    const cat = row.exercise_categories
    const c = Array.isArray(cat) ? cat[0] : cat
    out.push({
      category_id: row.category_id,
      name: c?.name ?? '',
    })
  }
  return out
}
