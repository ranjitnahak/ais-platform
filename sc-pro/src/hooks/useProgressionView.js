import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser } from '../lib/auth.js'
import { emitSessionExerciseSaved } from '../lib/sessionExerciseCrossTabSync.js'
import {
  embeddedSession,
  parseProgressionPickerLabel,
  pickProgrammeSessionForProgressionColumn,
  progressionSessionLabel,
  slotLabel,
  toVarFlags,
  weekdayLongEnGBFromSessionDate,
} from '../lib/progressionMatrixHelpers.js'
import { supabase } from '../lib/supabaseClient.js'

export function useProgressionView({ programmeId, weeks, activeSessionName, orgId }) {
  const user = getCurrentUser()
  const [matrixData, setMatrixData] = useState({ columns: [], rows: [], visibleVars: [] })
  const [matrixReloadSeq, setMatrixReloadSeq] = useState(0)
  const [sessionNames, setSessionNames] = useState([])
  const weekIds = useMemo(() => (weeks ?? []).map((w) => w.id).filter(Boolean), [weeks])

  useEffect(() => {
    if (!weekIds.length || !orgId) {
      setSessionNames([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('programme_sessions')
          .select('programme_week_id, sessions(name, session_date, team_id)')
          .eq('org_id', orgId)
          .in('programme_week_id', weekIds)
        if (error) throw error
        const uniq = []
        const seen = new Set()
        for (const row of data ?? []) {
          const sess = embeddedSession(row.sessions)
          if (!sess) continue
          const label = progressionSessionLabel(sess)
          if (!label) continue
          if (seen.has(label)) continue
          seen.add(label)
          uniq.push({ label, name: String(sess.name ?? '').trim() })
        }
        if (!cancelled) setSessionNames(uniq)
      } catch (err) {
        console.error('[ProgressionView] load sessionNames', err)
        if (!cancelled) setSessionNames([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [weekIds, orgId, user.teamIds])

  useEffect(() => {
    if (!weeks?.length || !orgId || !activeSessionName) {
      setMatrixData({
        columns: (weeks ?? []).map((w) => ({ weekId: w.id, weekNumber: w.week_number, sessionId: null })),
        rows: [],
        visibleVars: [],
      })
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const rowsByWeek = new Map()
        const columns = []

        const selectedName =
          (sessionNames.find((s) => s.label === activeSessionName)?.name ?? activeSessionName) || ''
        const { dayLabel } = parseProgressionPickerLabel(activeSessionName)
        const fetchBlocks = async (sessionId) => {
          const { data: blocks, error: bErr } = await supabase
            .from('session_blocks')
            .select(
              `
                id, label, sort_order,
                session_exercises (
                  id, exercise_id, sort_order, sets, reps,
                  prescription_type, prescription_value,
                  secondary_prescription_type, secondary_prescription_value,
                  tertiary_prescription_type, tertiary_prescription_value,
                  rest_seconds, exercise_library(name)
                )
              `,
            )
            .eq('session_id', sessionId)
            .eq('org_id', orgId)
            .order('sort_order', { ascending: true })
          if (bErr) throw bErr
          return blocks ?? []
        }

        for (const week of weeks) {
          const { data: psRows, error: psErr } = await supabase
            .from('programme_sessions')
            .select('id, session_id, sort_order, sessions(*)')
            .eq('programme_week_id', week.id)
            .eq('org_id', orgId)
            .order('sort_order', { ascending: true })
          if (psErr) throw psErr

          const visibleRows = (psRows ?? []).filter((r) => {
            const s = embeddedSession(r.sessions)
            return s && user.teamIds?.includes(s.team_id)
          })
          const target = pickProgrammeSessionForProgressionColumn(psRows, {
            activeSessionName,
            selectedName,
            teamIds: user.teamIds,
          })
          let chosen = target ?? null
          if (!chosen?.session_id && visibleRows.length) chosen = visibleRows[0]
          if (!chosen?.session_id) {
            columns.push({ weekId: week.id, weekNumber: week.week_number, sessionId: null })
            continue
          }
          let blocks = await fetchBlocks(chosen.session_id)
          const countRows = (bs) => bs.reduce((n, b) => n + (b.session_exercises?.length ?? 0), 0)
          let bestCount = countRows(blocks)
          const candidateRows = dayLabel ? visibleRows.filter((r) => {
            const s = embeddedSession(r.sessions)
            return s && weekdayLongEnGBFromSessionDate(s.session_date) === dayLabel
          }) : visibleRows
          if (candidateRows.length > 1) {
            for (const cand of candidateRows) {
              if (!cand?.session_id || cand.session_id === chosen.session_id) continue
              const candBlocks = await fetchBlocks(cand.session_id)
              const candCount = countRows(candBlocks)
              if (candCount > bestCount) {
                chosen = cand
                blocks = candBlocks
                bestCount = candCount
              }
            }
          }
          columns.push({ weekId: week.id, weekNumber: week.week_number, sessionId: chosen.session_id })

          rowsByWeek.set(week.id, {
            sessionId: chosen.session_id,
            blocks: blocks.map((b) => ({
              label: b.label || 'A',
              sort_order: b.sort_order ?? 0,
              exercises: [...(b.session_exercises ?? [])].sort(
                (a, z) => (a.sort_order ?? 0) - (z.sort_order ?? 0),
              ),
            })),
          })
        }

        const rowMap = new Map()
        for (const [weekId, wk] of rowsByWeek.entries()) {
          for (const blk of wk.blocks) {
            const seenPerExercise = new Map()
            blk.exercises.forEach((ex, idx) => {
              const exName = String(ex.exercise_library?.name ?? '').trim() || `Exercise ${idx + 1}`
              const exStable = ex.exercise_id ?? exName
              const occ = (seenPerExercise.get(exStable) ?? 0) + 1
              seenPerExercise.set(exStable, occ)
              // Align rows by block + exercise identity (+ occurrence), not raw index.
              const key = `${String(blk.label)}|${String(exStable)}|${occ}`
              if (!rowMap.has(key)) {
                rowMap.set(key, {
                  blockLabel: String(blk.label),
                  slotOrder: idx,
                  exerciseOrder: ex.sort_order ?? idx,
                  exerciseId: ex.exercise_id ?? null,
                  exerciseName: exName,
                  slotLabel: slotLabel(blk.label, idx),
                  cells: {},
                })
              }
              const row = rowMap.get(key)
              row.cells[weekId] = {
                exerciseRowId: ex.id,
                sets: ex.sets ?? null,
                reps: ex.reps ?? null,
                prescriptionType: ex.prescription_type ?? null,
                prescriptionValue: ex.prescription_value ?? null,
                secondaryPrescriptionType: ex.secondary_prescription_type ?? null,
                secondaryPrescriptionValue: ex.secondary_prescription_value ?? null,
                tertiaryPrescriptionType: ex.tertiary_prescription_type ?? null,
                tertiaryPrescriptionValue: ex.tertiary_prescription_value ?? null,
                rpe:
                  ex.prescription_type === 'rpe'
                    ? ex.prescription_value ?? null
                    : ex.secondary_prescription_type === 'rpe'
                      ? ex.secondary_prescription_value ?? null
                      : ex.tertiary_prescription_type === 'rpe'
                        ? ex.tertiary_prescription_value ?? null
                        : null,
                restSeconds: ex.rest_seconds ?? null,
              }
            })
          }
        }

        const groupedRows = []
        const byBlock = new Map()
        for (const row of rowMap.values()) {
          if (!byBlock.has(row.blockLabel)) byBlock.set(row.blockLabel, [])
          byBlock.get(row.blockLabel).push(row)
        }
        for (const [blockLabel, exRows] of [...byBlock.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          exRows.sort((a, b) => a.exerciseOrder - b.exerciseOrder)
          const enriched = exRows.map((r) => {
            const cells = {}
            for (const col of columns) {
              cells[col.weekId] = r.cells[col.weekId] ?? {
                exerciseRowId: null,
                sets: null,
                reps: null,
                prescriptionType: null,
                prescriptionValue: null,
                secondaryPrescriptionType: null,
                secondaryPrescriptionValue: null,
                tertiaryPrescriptionType: null,
                tertiaryPrescriptionValue: null,
                rpe: null,
                restSeconds: null,
              }
            }
            return {
              exerciseId: r.exerciseId,
              exerciseName: r.exerciseName,
              slotLabel: r.slotLabel,
              cells,
            }
          })
          groupedRows.push({ blockLabel, exercises: enriched })
        }
        const visibleVars = toVarFlags(rowsByWeek)
        if (!cancelled) setMatrixData({ columns, rows: groupedRows, visibleVars })
      } catch (err) {
        console.error('[ProgressionView] load matrix', err)
        if (!cancelled) setMatrixData({ columns: [], rows: [], visibleVars: [] })
      }
    })()
    return () => { cancelled = true }
  }, [programmeId, weeks, activeSessionName, orgId, sessionNames, matrixReloadSeq, user.teamIds])
  const getOrCreateExerciseRow = useCallback(async ({
      orgId: scopeOrgId,
      weekId,
      sourceSessionId,
      blockLabel,
      blockSortOrder,
      exerciseId,
      exerciseSortOrder,
      teamId,
    }) => {
      const { data: existingPs, error: psErr } = await supabase
        .from('programme_sessions')
        .select(
          'session_id, sessions(id, session_date, start_time, name, category, session_type, duration_planned, coach_instructions, venue)',
        )
        .eq('programme_week_id', weekId)
        .eq('org_id', scopeOrgId)
        .limit(1)
        .maybeSingle()
      if (psErr) throw psErr
      let sessionId
      if (existingPs?.session_id) {
        sessionId = existingPs.session_id
      } else {
        const { data: src, error: srcErr } = await supabase
          .from('sessions')
          .select('name, start_time, category, session_type, duration_planned, session_date, team_id')
          .eq('id', sourceSessionId)
          .eq('org_id', scopeOrgId)
          .maybeSingle()
        if (srcErr) throw srcErr
        const { data: newSess, error: newSErr } = await supabase
          .from('sessions')
          .insert({
            org_id: scopeOrgId,
            team_id: src?.team_id ?? teamId,
            session_date: src?.session_date ?? null,
            start_time: src?.start_time ?? '09:00:00',
            name: src?.name ?? 'Session',
            category: src?.category ?? null,
            session_type: src?.session_type ?? null,
            duration_planned: src?.duration_planned ?? null,
            programme_week_id: weekId,
            is_published: false,
          })
          .select('id')
          .single()
        if (newSErr) throw newSErr
        sessionId = newSess.id
        const { error: psInsErr } = await supabase.from('programme_sessions').insert({
          org_id: scopeOrgId,
          programme_week_id: weekId,
          session_id: sessionId,
          sort_order: 0,
        })
        if (psInsErr) throw psInsErr
      }
      const { data: existingBlock, error: blockErr } = await supabase
        .from('session_blocks')
        .select('id')
        .eq('session_id', sessionId)
        .eq('org_id', scopeOrgId)
        .eq('label', blockLabel)
        .maybeSingle()
      if (blockErr) throw blockErr
      let blockId
      if (existingBlock?.id) {
        blockId = existingBlock.id
      } else {
        const { data: newBlock, error: nbErr } = await supabase
          .from('session_blocks')
          .insert({ org_id: scopeOrgId, session_id: sessionId, label: blockLabel, sort_order: blockSortOrder ?? 0 })
          .select('id')
          .single()
        if (nbErr) throw nbErr
        blockId = newBlock.id
      }
      const { data: existingEx, error: exErr } = await supabase
        .from('session_exercises')
        .select('id')
        .eq('block_id', blockId)
        .eq('org_id', scopeOrgId)
        .eq('exercise_id', exerciseId)
        .maybeSingle()
      if (exErr) throw exErr
      if (existingEx?.id) return existingEx.id
      const { data: newEx, error: newExErr } = await supabase
        .from('session_exercises')
        .insert({ org_id: scopeOrgId, block_id: blockId, exercise_id: exerciseId, sort_order: exerciseSortOrder ?? 0 })
        .select('id')
        .single()
      if (newExErr) throw newExErr
      return newEx.id
    }, [])
  const saveCell = useCallback(
    async (exerciseRowId, field, value, creationContext) => {
      if (!orgId) return
      if (!exerciseRowId) {
        if (!creationContext) return
        try {
          exerciseRowId = await getOrCreateExerciseRow({ orgId, ...creationContext })
        } catch (err) {
          console.error('[ProgressionView] getOrCreateExerciseRow', err)
          throw err
        }
      }
      const colMap = { sets: 'sets', Reps: 'reps', '%1RM': 'prescription_value', RPE: 'prescription_value', RIR: 'prescription_value', Time: 'prescription_value', Absolute: 'prescription_value', Vel: 'prescription_value', Dist: 'prescription_value', Max: 'prescription_value', Rest: 'rest_seconds' }
      const column = colMap[field]
      if (!column) return
      try {
        let patch
        if (field === '%1RM') {
          const { data: row, error: selErr } = await supabase.from('session_exercises').select('prescription_type, secondary_prescription_type, tertiary_prescription_type').eq('id', exerciseRowId).maybeSingle()
          if (selErr) throw selErr
          patch = row?.prescription_type === 'pct_1rm' ? { prescription_value: value, prescription_type: 'pct_1rm' } : row?.secondary_prescription_type === 'pct_1rm' ? { secondary_prescription_value: value, secondary_prescription_type: 'pct_1rm' } : row?.tertiary_prescription_type === 'pct_1rm' ? { tertiary_prescription_value: value, tertiary_prescription_type: 'pct_1rm' } : { prescription_value: value, prescription_type: 'pct_1rm' }
        } else {
          patch = { [column]: value }
          const prescriptionTypes = { RPE: 'rpe', RIR: 'rir', Time: 'time', Absolute: 'absolute', Vel: 'velocity', Dist: 'distance', Max: 'max' }
          if (field in prescriptionTypes) patch.prescription_type = prescriptionTypes[field]
        }
        const { data: updatedRows, error } = await supabase
          .from('session_exercises')
          .update(patch)
          .eq('id', exerciseRowId)
          .select('id, block_id, session_blocks(session_id)')
        if (error) throw error
        if (!updatedRows?.length) throw new Error(`saveCell matched 0 rows — exerciseRowId=${exerciseRowId}`)
        const row0 = updatedRows[0]
        const sb = row0?.session_blocks
        let sid = Array.isArray(sb) ? sb[0]?.session_id : sb?.session_id
        if (!sid && row0?.block_id) {
          const { data: blk } = await supabase
            .from('session_blocks')
            .select('session_id')
            .eq('id', row0.block_id)
            .maybeSingle()
          sid = blk?.session_id ?? null
        }
        setMatrixReloadSeq((s) => s + 1)
        emitSessionExerciseSaved({
          programmeId,
          sessionId: sid,
          sessionExerciseId: exerciseRowId,
          patch,
        })
      } catch (err) {
        console.error('[ProgressionView] saveCell', err)
        throw err
      }
    },
    [orgId, getOrCreateExerciseRow, programmeId],
  )

  return { matrixData, sessionNames, saveCell }
}
