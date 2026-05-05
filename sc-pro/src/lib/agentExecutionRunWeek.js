import { resolveAgentSessionDate } from './agentSessionDates.js'
import { executeAction } from './assistantActions.js'
import { pingWeekBuildWithReference } from './programmeImporter.js'

function normCategory(cat) {
  const c = String(cat || 'strength').toLowerCase()
  const allowed = new Set(['strength', 'power', 'speed', 'conditioning', 'mobility', 'recovery', 'mixed'])
  return allowed.has(c) ? c : 'strength'
}

function mapExerciseToCreatePayload(ex, blockId, sortOrder, match) {
  const m = match || {}
  let prescription_type = ex.prescription_type || 'max'
  let prescription_value = ex.prescription_value ?? null
  let secondary_prescription_type = null
  let secondary_prescription_value = null

  const rLow = ex.prescription_range_low
  const rHigh = ex.prescription_range_high
  if (rLow != null && rHigh != null) {
    prescription_value = (Number(rLow) + Number(rHigh)) / 2
  }

  if (prescription_type === 'rpe') {
    prescription_value = ex.prescription_value ?? ex.rpe ?? null
  } else if (ex.rpe != null && prescription_type !== 'rpe') {
    secondary_prescription_type = 'rpe'
    secondary_prescription_value = Number(ex.rpe)
  }

  if (ex.rpe_range_low != null && ex.rpe_range_high != null && prescription_type === 'rpe') {
    prescription_value = (Number(ex.rpe_range_low) + Number(ex.rpe_range_high)) / 2
  }

  const payload = {
    block_id: blockId,
    sort_order: sortOrder,
    exercise_id: m.matchedId ?? null,
    exercise_name: !m.matchedId ? String(ex.name || '').trim() : null,
    sets: Number(ex.sets) || 3,
    reps: ex.reps != null ? Number(ex.reps) : null,
    prescription_type,
    prescription_value,
    secondary_prescription_type,
    secondary_prescription_value,
    prescription_range_low: ex.prescription_range_low ?? null,
    prescription_range_high: ex.prescription_range_high ?? null,
    rest_seconds: ex.rest_seconds ?? null,
    tempo: ex.tempo ?? null,
    coach_note: ex.coach_note ?? null,
  }
  return payload
}

function syntheticDecisionForExerciseUnknown(exName, match, weekNumber) {
  const sug = match?.suggestions?.[0]
  return {
    type: 'exercise_unknown',
    description: `'${exName}' is not in the exercise library. How shall I handle it?`,
    options: [
      'Create as new exercise',
      'Skip this exercise',
      sug ? `Find closest match: ${sug.name}` : 'Find closest match',
    ],
    default: 'Create as new exercise',
    affects: String(weekNumber),
    __meta: { exerciseName: exName, suggestionId: sug?.id ?? null },
  }
}

/**
 * @param {(decision: object) => Promise<string>} gateDecision — resolves coach choice label
 */
export async function executeWeekBuild({
  host,
  weekNumber,
  weekPlan,
  matchMap,
  overrides,
  gateDecision,
  onStep,
  onSkipped,
  pdfBase64,
  pdfMediaType,
  isStopped,
}) {
  const user = (await import('./auth.js')).getCurrentUser()
  const programme = host.programme
  const teamId = host.teamId
  const weeks = host.weeks ?? []
  const weekRow = weeks.find((w) => w.week_number === weekNumber)
  if (!weekRow?.id) throw new Error(`Programme has no week row for week ${weekNumber}`)
  const programmeWeekId = weekRow.id

  const chk = () => {
    if (isStopped?.()) return true
    return false
  }

  try {
    const note = await pingWeekBuildWithReference({
      pdfBase64,
      pdfMediaType,
      weekNumber,
      weekData: weekPlan,
      overrides,
    })
    if (note) onStep?.(`Supervisor: ${note.slice(0, 120)}`)
  } catch (e) {
    console.warn('[agentExecutionRunWeek] pingWeekBuildWithReference', e)
  }

  if (chk()) return

  let sessions = [...(weekPlan?.sessions ?? [])]

  const skipCat = weekPlan?.__skipCategories
  if (skipCat instanceof Set && skipCat.size) {
    sessions = sessions.filter((s) => !skipCat.has(normCategory(s.category)))
  }

  const missingDays = sessions.some((s) => !s.day_of_week)
  if (missingDays) {
    const choice = await gateDecision({
      type: 'missing_day',
      description: `No days assigned for Week ${weekNumber} sessions. How shall I schedule them?`,
      options: ['Mon/Wed/Fri', 'Tue/Thu/Sat', "I'll assign days manually"],
      default: 'Mon/Wed/Fri',
      affects: String(weekNumber),
      __meta: { kind: 'missing_day' },
    })
    if (chk() || choice === 'Stop') return
    if (choice === 'Mon/Wed/Fri') {
      const pat = [0, 2, 4]
      let k = 0
      for (const s of sessions) {
        const dow = ['monday', 'wednesday', 'friday'][pat[k % 3]]
        s.day_of_week = dow
        k++
      }
    } else if (choice === 'Tue/Thu/Sat') {
      const pat = [1, 3, 5]
      let k = 0
      for (const s of sessions) {
        const dow = ['tuesday', 'thursday', 'saturday'][pat[k % 3]]
        s.day_of_week = dow
        k++
      }
    } else {
      sessions.forEach((s) => {
        if (!s.day_of_week) s.day_of_week = 'monday'
      })
    }
  }

  for (let si = 0; si < sessions.length; si++) {
    if (chk()) return
    const sess = sessions[si]
    const sessionDate = resolveAgentSessionDate(programme, weekNumber, sess.day_of_week)
    if (!sessionDate) {
      try {
        onSkipped?.({ kind: 'session', name: sess.name, reason: 'No session date' })
      } catch {
        /* ignore */
      }
      continue
    }

    onStep?.(`Creating session: ${sess.name || 'Session'}`)

    let sessionRow
    try {
      sessionRow = await executeAction({
        type: 'create_session_for_build',
        payload: {
          team_id: teamId,
          programme_week_id: programmeWeekId,
          name: sess.name || 'Session',
          session_date: sessionDate,
          category: normCategory(sess.category),
          planned_duration_min: sess.planned_duration_min ?? 60,
          coach_instructions: sess.coach_instructions ?? null,
        },
      })
    } catch (e) {
      try {
        onSkipped?.({ kind: 'session', name: sess.name, reason: e?.message ?? String(e) })
      } catch {
        /* ignore */
      }
      continue
    }

    const sessionId = sessionRow?.id
    if (!sessionId) continue

    const blocks = [...(sess.blocks ?? [])]
    for (let bi = 0; bi < blocks.length; bi++) {
      const blk = blocks[bi]
      const clusterLike =
        String(blk.format || '').toLowerCase() === 'custom' &&
        String(blk.format_note || '')
          .toLowerCase()
          .includes('cluster')

      if (clusterLike) {
        const ch = await gateDecision({
          type: 'unsupported_format',
          description: `Block format '${blk.format_note || 'custom'}' is not supported. How shall I label this block?`,
          options: ['Straight Sets', 'Custom', 'Skip block'],
          default: 'Custom',
          affects: String(weekNumber),
          __meta: { blockIndex: bi },
        })
        if (chk() || ch === 'Stop') return
        if (ch === 'Straight Sets') blk.format = 'straight'
        else if (ch === 'Skip block') continue
      }

      onStep?.(`Adding block ${blk.label || 'A'} (${blk.format || 'straight'})`)

      let blockRow
      try {
        blockRow = await executeAction({
          type: 'create_block_for_build',
          payload: {
            session_id: sessionId,
            label: String(blk.label || 'A').slice(0, 8),
            format: blk.format || 'straight',
            format_note: blk.format_note ?? null,
            sort_order: bi,
          },
        })
      } catch (e) {
        try {
          onSkipped?.({ kind: 'block', session: sess.name, reason: e?.message ?? String(e) })
        } catch {
          /* ignore */
        }
        continue
      }

      const blockId = blockRow?.id
      if (!blockId) continue

      const exercises = [...(blk.exercises ?? [])]
      for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei]
        const exName = String(ex.name || '').trim()
        const match = matchMap.get(exName)

        if (!match?.matchedId && match?.matchType !== 'exact') {
          const decision = syntheticDecisionForExerciseUnknown(exName, match, weekNumber)
          const pick = await gateDecision(decision)
          if (chk() || pick === 'Stop') return
          if (pick === 'Skip this exercise') {
            try {
              onSkipped?.({ kind: 'exercise', name: exName, reason: 'Skipped by coach' })
            } catch {
              /* ignore */
            }
            continue
          }
          if (pick.startsWith('Find closest match') && match?.suggestions?.length) {
            match.matchedId = match.suggestions[0].id
            match.matchType = 'fuzzy'
          }
        }

        onStep?.(`Adding exercise: ${exName}`)

        try {
          await executeAction({
            type: 'create_exercise_for_build',
            payload: mapExerciseToCreatePayload(ex, blockId, ei, match),
          })
        } catch (e) {
          try {
            onSkipped?.({ kind: 'exercise', name: exName, reason: e?.message ?? String(e) })
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
}
