/** Nested select for programme week session preview (matches SC Pro schema). */
export const SESSION_PREVIEW_SELECT = `
  *,
  session_blocks(
    id, label, sort_order, block_type,
    session_exercises(
      id, sort_order, sets, reps,
      prescription_type, prescription_value,
      superset_group,
      exercise_library(name)
    )
  )
`
