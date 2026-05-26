/**
 * Runtime registry for assistant-proposed write actions.
 * Pages register executors; confirmAction in useAssistant invokes them.
 */

/** Matches exercise_library visibility used in SessionExerciseSearch (global + org-approved/custom). */
function exerciseLibraryVisibilityOr(orgId, userId) {
  // Approved exception: system default exercises use null org_id by design.
  return `org_id.is.null,and(org_id.eq.${orgId},or(status.eq.approved,created_by.eq.${userId}))`
}

/**
 * Factory for add_exercise_to_block: resolves exercise_name → exercise_id via exercise_library, then inserts.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, getUser: () => { orgId: string, id: string }, getBlocks: () => unknown[] }} deps
 */
export function createAddExerciseToBlockExecutor({ supabase, getUser, getBlocks }) {
  return async (payload) => {
    const user = getUser()
    let exerciseId = payload.exercise_id

    if (!exerciseId && payload.exercise_name) {
      const name = String(payload.exercise_name).trim()
      const { data: ex, error } = await supabase
        .from('exercise_library')
        .select('id')
        .or(exerciseLibraryVisibilityOr(user.orgId, user.id))
        .ilike('name', name)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!ex?.id) throw new Error(`Exercise "${payload.exercise_name}" not found in library`)
      exerciseId = ex.id
    }

    if (!payload.block_id) throw new Error('block_id is required')
    if (!exerciseId) throw new Error('exercise_id is required')

    const blocks = getBlocks() ?? []
    const block = blocks.find((b) => b.id === payload.block_id)
    const nextSort = block?.session_exercises?.length
      ? Math.max(...block.session_exercises.map((e) => e.sort_order ?? 0)) + 1
      : 0

    const { data, error } = await supabase.from('session_exercises').insert({
      block_id: payload.block_id,
      org_id: user.orgId,
      exercise_id: exerciseId,
      sets: payload.sets ?? 3,
      reps: payload.reps ?? null,
      prescription_type: payload.prescription_type ?? null,
      prescription_value: payload.prescription_value ?? null,
      rest_seconds: payload.rest_seconds ?? null,
      tempo: payload.tempo ?? null,
      sort_order: payload.sort_order ?? nextSort,
      coach_note: payload.coach_note ?? null,
    })
    if (error) throw error
    return data
  }
}

const actionRegistry = {}

export function registerAction(actionKey, executorFn) {
  actionRegistry[actionKey] = executorFn
}

export function unregisterAction(actionKey) {
  delete actionRegistry[actionKey]
}

export async function executeAction(action) {
  if (!action?.type) throw new Error('[assistantActions] Missing action.type')
  const executor = actionRegistry[action.type]
  if (!executor) {
    throw new Error(
      `[assistantActions] Unknown action: ${action.type}. Register it with registerAction() on the relevant page.`,
    )
  }
  return executor(action.payload ?? {})
}

export function getRegisteredActions() {
  return Object.keys(actionRegistry)
}
