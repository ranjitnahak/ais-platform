import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { can, getCurrentUser } from '../lib/auth.js'
import { useSessionData } from '../hooks/useSessionData.js'
import { useSessionBuilderRemoteRefresh } from '../hooks/useSessionBuilderRemoteRefresh.js'
import { useSessionBuilderCrumb } from '../hooks/useSessionBuilderCrumb.js'
import SessionBuilderLeft from '../components/session/SessionBuilderLeft.jsx'
import SessionInfoPanel from '../components/SessionInfoPanel.jsx'
import SessionExerciseSearch from '../components/session/SessionExerciseSearch.jsx'
import SessionBuilderBlocksList from '../components/session/SessionBuilderBlocksList.jsx'
import { btnOutlineSm } from '../lib/sessionBuilderUi.js'
import { ASSISTANT_ACTION_COMPLETE, registerPageContext } from '../lib/assistantContext.js'
import { registerAction, unregisterAction } from '../lib/assistantActions.js'
import { useAssistantSessionBuilder } from '../hooks/useAssistantSessionBuilder.js'
import { getDefaultCues } from '../lib/sessionDefaultCues.js'

/** Matches DB enum sc_pro_prescription_type (absolute, pct_1rm, rpe, …). */
const SC_PRO_PRESCRIPTION_TYPES = new Set([
  'absolute',
  'pct_1rm',
  'rpe',
  'rir',
  'velocity',
  'max',
  'time',
  'distance',
  'custom',
])

/** Normalise assistant / UI labels to DB enum values. */
function normalizePrescriptionTypeForDb(raw) {
  if (raw == null || raw === '') return undefined
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_')
  if (SC_PRO_PRESCRIPTION_TYPES.has(s)) return s
  if (
    s === 'percentage' ||
    s === 'percent' ||
    s === 'pct' ||
    s === 'pct_of_1rm' ||
    s === 'percent_1rm' ||
    s === '1rm_percentage' ||
    s === '%_1rm'
  ) {
    return 'pct_1rm'
  }
  if (s === 'weight' || s === 'load' || s === 'kg') return 'absolute'
  return undefined
}

function resolvePrescriptionType(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = normalizePrescriptionTypeForDb(raw)
  if (n !== undefined) return n
  throw new Error(
    `Unknown prescription_type "${raw}". Valid: absolute, pct_1rm (for % of 1RM), rpe, rir, velocity, max, time, distance, custom.`,
  )
}

export default function SessionBuilder() {
  const { programmeId, sessionId } = useParams()
  const navigate = useNavigate()
  const user = getCurrentUser()
  const {
    session,
    blocks,
    setBlocks,
    loading,
    error,
    reload,
    applyExercisePatch,
    athleteNames,
    oneRmByAthleteExercise,
    athleteLoadsMessage,
    rosterTeamId,
  } = useSessionData(sessionId)
  useSessionBuilderRemoteRefresh(programmeId, reload)

  useEffect(() => {
    const onPatch = (e) => {
      const d = e.detail
      if (!d?.sessionExerciseId || !d?.patch) return
      const evtSid = d.sessionId
      if (evtSid != null && evtSid !== '' && String(evtSid) !== String(sessionId)) return
      applyExercisePatch(d.sessionExerciseId, d.patch)
    }
    window.addEventListener('sc-pro-session-exercise-patch', onPatch)
    return () => window.removeEventListener('sc-pro-session-exercise-patch', onPatch)
  }, [sessionId, applyExercisePatch])

  const crumb = useSessionBuilderCrumb(session, user.orgId)
  const [title, setTitle] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [addForBlockId, setAddForBlockId] = useState(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState(null)
  const [toast, setToast] = useState(null)
  const [coachInstructions, setCoachInstructions] = useState('')
  const canManageProgramme = can('programme', 'edit')
  const canEditSession = canManageProgramme && !session?.is_published

  useEffect(() => {
    if (session?.name) setTitle(session.name)
  }, [session?.id, session?.name])

  useEffect(() => {
    if (!session?.id) return
    const instructions = session.coach_instructions
    setCoachInstructions(
      instructions && instructions.trim().length > 0 ? instructions : getDefaultCues(session.category),
    )
  }, [session?.id, session?.coach_instructions, session?.category])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (canEditSession) return
    setSearchOpen(false)
    setAddForBlockId(null)
  }, [canEditSession])

  const selectedExercise = useMemo(() => {
    for (const b of blocks) {
      for (const ex of b.session_exercises || []) {
        if (ex.id === selectedExerciseId) return { ...ex, block_id: b.id }
      }
    }
    return null
  }, [blocks, selectedExerciseId])

  const selectExerciseRow = useCallback((id) => {
    setSelectedExerciseId((cur) => (cur === id ? null : id))
  }, [])

  const saveSessionTitle = useCallback(async () => {
    if (!session || !canEditSession) return
    try {
      const { error } = await supabase.from('sessions').update({ name: title }).eq('id', session.id).eq('org_id', user.orgId)
      if (error) throw error
      await reload()
    } catch (e) {
      console.error('[SessionBuilder]', e)
    }
  }, [session, title, user.orgId, reload, canEditSession])

  const togglePublish = useCallback(async () => {
    if (!session || !canManageProgramme) return
    try {
      const next = !session.is_published
      const { error } = await supabase
        .from('sessions')
        .update({ is_published: next, publish_at: next ? new Date().toISOString() : null })
        .eq('id', session.id)
        .eq('org_id', user.orgId)
      if (error) throw error
      await reload()
    } catch (e) {
      console.error('[SessionBuilder]', e)
    }
  }, [session, user.orgId, reload, canManageProgramme])

  const addBlock = useCallback(async () => {
    if (!session || !canEditSession) return
    try {
      const nextLabel = String.fromCharCode(65 + blocks.length)
      const sort = blocks.length ? Math.max(...blocks.map((b) => b.sort_order ?? 0)) + 1 : 0
      const { error } = await supabase.from('session_blocks').insert({
        session_id: session.id,
        org_id: user.orgId,
        label: nextLabel,
        block_type: 'main',
        format: 'straight',
        sort_order: sort,
      })
      if (error) throw error
      await reload()
    } catch (e) {
      console.error('[SessionBuilder]', e)
    }
  }, [session, blocks, user.orgId, reload, canEditSession])

  const deleteExercise = useCallback(
    async (exerciseId) => {
      if (!canEditSession) return
      const snapshot = blocks.map((b) => ({
        ...b,
        session_exercises: [...(b.session_exercises || [])],
      }))
      setBlocks((bs) =>
        bs.map((b) => ({
          ...b,
          session_exercises: (b.session_exercises || []).filter((e) => e.id !== exerciseId),
        })),
      )
      if (selectedExerciseId === exerciseId) setSelectedExerciseId(null)
      setToast('Exercise removed')
      try {
        const { error } = await supabase.from('session_exercises').delete().eq('id', exerciseId).eq('org_id', user.orgId)
        if (error) throw error
      } catch (err) {
        console.error('[SessionBuilder] delete exercise', err)
        setBlocks(snapshot)
        setToast(null)
      }
    },
    [blocks, selectedExerciseId, user.orgId, setBlocks, canEditSession],
  )

  const toggleSupersetLink = useCallback(
    async (blockId, exerciseId, sortedIndex) => {
      if (!canEditSession) return
      const block = blocks.find((b) => b.id === blockId)
      if (!block) return
      const sorted = [...(block.session_exercises || [])].sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0))
      const ex = sorted[sortedIndex]
      const nextEx = sorted[sortedIndex + 1]
      if (!ex) return

      let maxG = 0
      for (const b of blocks) {
        for (const row of b.session_exercises || []) {
          if (row.superset_group != null) maxG = Math.max(maxG, Number(row.superset_group))
        }
      }

      try {
        if (ex.superset_group != null && ex.superset_group !== undefined) {
          const { error } = await supabase
            .from('session_exercises')
            .update({ superset_group: null })
            .eq('id', exerciseId)
            .eq('org_id', user.orgId)
          if (error) throw error
          setBlocks((bs) =>
            bs.map((b) =>
              b.id !== blockId
                ? b
                : {
                    ...b,
                    session_exercises: (b.session_exercises || []).map((row) =>
                      row.id === exerciseId ? { ...row, superset_group: null } : row,
                    ),
                  },
            ),
          )
        } else {
          if (!nextEx) return
          const newG = maxG + 1
          const { error: e1 } = await supabase
            .from('session_exercises')
            .update({ superset_group: newG })
            .eq('id', ex.id)
            .eq('org_id', user.orgId)
          if (e1) throw e1
          const { error: e2 } = await supabase
            .from('session_exercises')
            .update({ superset_group: newG })
            .eq('id', nextEx.id)
            .eq('org_id', user.orgId)
          if (e2) throw e2
          setBlocks((bs) =>
            bs.map((b) =>
              b.id !== blockId
                ? b
                : {
                    ...b,
                    session_exercises: (b.session_exercises || []).map((row) =>
                      row.id === ex.id || row.id === nextEx.id ? { ...row, superset_group: newG } : row,
                    ),
                  },
            ),
          )
        }
      } catch (err) {
        console.error('[SessionBuilder] superset link', err)
        await reload()
      }
    },
    [blocks, user.orgId, setBlocks, reload, canEditSession],
  )

  const applyExerciseLayout = useCallback(
    async (layout) => {
      if (!canEditSession) return
      try {
        for (const { blockId, exerciseIds } of layout) {
          for (let i = 0; i < exerciseIds.length; i++) {
            const { error } = await supabase
              .from('session_exercises')
              .update({ block_id: blockId, sort_order: i })
              .eq('id', exerciseIds[i])
              .eq('org_id', user.orgId)
            if (error) throw error
          }
        }
        await reload()
      } catch (e) {
        console.error('[SessionBuilder]', e)
      }
    },
    [user.orgId, reload, canEditSession],
  )

  const applyBlockOrder = useCallback(
    async (orderedBlockIds) => {
      if (!canEditSession || !orderedBlockIds?.length) return
      try {
        for (let i = 0; i < orderedBlockIds.length; i++) {
          const { error } = await supabase
            .from('session_blocks')
            .update({ sort_order: i })
            .eq('id', orderedBlockIds[i])
            .eq('org_id', user.orgId)
          if (error) throw error
        }
        await reload()
      } catch (e) {
        console.error('[SessionBuilder] applyBlockOrder', e)
      }
    },
    [user.orgId, reload, canEditSession],
  )

  const addExercise = useCallback(
    async (exerciseRow) => {
      if (!addForBlockId || !canEditSession) return
      try {
        const block = blocks.find((b) => b.id === addForBlockId)
        const list = block?.session_exercises || []
        const maxSort = list.length ? Math.max(...list.map((e) => e.sort_order ?? 0)) : -1
        const { error } = await supabase.from('session_exercises').insert({
          block_id: addForBlockId,
          org_id: user.orgId,
          exercise_id: exerciseRow.id,
          sort_order: maxSort + 1,
          sets: 3,
          reps: null,
          prescription_type: 'max',
          prescription_value: null,
        })
        if (error) throw error
        await reload()
      } catch (e) {
        console.error('[SessionBuilder]', e)
      }
    },
    [addForBlockId, blocks, user.orgId, reload, canEditSession],
  )

  useAssistantSessionBuilder({ session, blocks })

  useEffect(() => {
    if (!session?.id) return

    registerPageContext('session_builder', () => ({
      orgId: user.orgId,
      session: {
        id: session.id,
        name: session.name,
        date: session.session_date,
        category: session.category,
      },
      blocks: (blocks ?? []).map((b) => ({
        id: b.id,
        label: b.label,
        format: b.format,
        exercises: (b.session_exercises ?? []).map((e) => {
          const lib = e.exercise_library
          const libRow = Array.isArray(lib) ? lib[0] : lib
          return {
            id: e.id,
            exercise_id: e.exercise_id,
            name: e.exercise_name ?? libRow?.name ?? null,
            sets: e.sets,
            reps: e.reps,
            prescription_type: e.prescription_type,
            prescription_value: e.prescription_value,
          }
        }),
      })),
      availableActions: [
        'add_exercise_to_block',
        'add_block',
        'change_prescription',
        'clear_session_blocks',
      ],
    }))

    registerAction('add_exercise_to_block', async (payload) => {
      const u = getCurrentUser()

      const exercises =
        payload.exercises ??
        (payload.exercise_name || payload.exercise_id
          ? [
              {
                exercise_name: payload.exercise_name,
                exercise_id: payload.exercise_id,
                sets: payload.sets,
                reps: payload.reps,
                prescription_type: payload.prescription_type,
                prescription_value: payload.prescription_value,
                rest_seconds: payload.rest_seconds,
                tempo: payload.tempo,
                coach_note: payload.coach_note,
              },
            ]
          : [])

      if (!exercises.length) throw new Error('No exercises provided')
      if (!payload.block_id) throw new Error('block_id is required')

      const results = []
      let sortOrder = payload.sort_order_start ?? 99

      for (const ex of exercises) {
        let exerciseId = ex.exercise_id

        if (!exerciseId && ex.exercise_name) {
          const { data: found, error: lookupErr } = await supabase
            .from('exercise_library')
            .select('id')
            .or(`org_id.is.null,org_id.eq.${u.orgId}`)
            .ilike('name', String(ex.exercise_name).trim())
            .limit(1)
            .maybeSingle()
          if (lookupErr) throw lookupErr
          if (!found?.id) {
            throw new Error(`Exercise "${ex.exercise_name}" not found in library`)
          }
          exerciseId = found.id
        }

        if (!exerciseId) {
          throw new Error(`exercise_id is required for ${ex.exercise_name ?? 'unknown'}`)
        }

        const rawPtEx = ex.prescription_type
        const prescriptionTypeRow =
          rawPtEx != null && String(rawPtEx).trim() !== ''
            ? resolvePrescriptionType(rawPtEx)
            : 'absolute'

        const { data, error } = await supabase
          .from('session_exercises')
          .insert({
            block_id: payload.block_id,
            org_id: u.orgId,
            exercise_id: exerciseId,
            sets: ex.sets ?? 3,
            reps: ex.reps ?? null,
            prescription_type: prescriptionTypeRow,
            prescription_value: ex.prescription_value ?? null,
            rest_seconds: ex.rest_seconds ?? null,
            tempo: ex.tempo ?? null,
            sort_order: sortOrder++,
            coach_note: ex.coach_note ?? null,
          })
          .select()
          .single()
        if (error) throw error
        results.push(data)
      }

      return results
    })

    registerAction('change_prescription', async (payload) => {
      const u = getCurrentUser()

      const displayName = (ex) => {
        const lib = ex.exercise_library
        const row = Array.isArray(lib) ? lib[0] : lib
        return String(row?.name ?? ex.exercise_name ?? ex.name ?? '').trim()
      }

      const norm = (s) =>
        String(s ?? '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')

      const resolveSessionExerciseId = (item) => {
        if (item.session_exercise_id) return item.session_exercise_id
        const want = norm(item.exercise_name ?? item.name)
        if (!want) return null
        for (const b of blocks ?? []) {
          for (const ex of b.session_exercises ?? []) {
            if (norm(displayName(ex)) === want) return ex.id
          }
        }
        return null
      }

      const patchFrom = (item) => {
        const rawType = item.prescription_type ?? payload.prescription_type
        const prescription_type = resolvePrescriptionType(rawType)
        return {
          ...(prescription_type !== undefined ? { prescription_type } : {}),
          prescription_value: item.prescription_value ?? payload.prescription_value,
          sets: item.sets ?? payload.sets,
          reps: item.reps ?? payload.reps,
        }
      }

      const batch =
        payload.changes ?? payload.updates ?? (Array.isArray(payload.exercises) ? payload.exercises : null)

      if (Array.isArray(batch) && batch.length > 0) {
        for (const item of batch) {
          const rowId = resolveSessionExerciseId(item)
          if (!rowId) {
            throw new Error(
              `Could not resolve session exercise for "${item.exercise_name ?? item.name ?? 'unknown'}" — use blocks[].exercises[].id as session_exercise_id, or exercise_name matching context.`,
            )
          }
          const patch = patchFrom(item)
          const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
          if (!Object.keys(clean).length) continue
          const { error } = await supabase
            .from('session_exercises')
            .update(clean)
            .eq('id', rowId)
            .eq('org_id', u.orgId)
          if (error) throw error
        }
        return
      }

      const rowId = payload.session_exercise_id ?? resolveSessionExerciseId(payload)
      if (!rowId) {
        throw new Error(
          'session_exercise_id is required — use blocks[].exercises[].id from context, or pass changes: [{ exercise_name, sets, reps }, ...] for multiple rows.',
        )
      }
      const patch = patchFrom(payload)
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { error } = await supabase
        .from('session_exercises')
        .update(clean)
        .eq('id', rowId)
        .eq('org_id', u.orgId)
      if (error) throw error
    })

    registerAction('add_block', async (payload) => {
      const u = getCurrentUser()
      const nextLabel = String.fromCharCode(65 + (blocks?.length ?? 0))
      const sort = blocks?.length ? Math.max(...blocks.map((b) => b.sort_order ?? 0)) + 1 : 0

      const { data: newBlock, error: blockErr } = await supabase
        .from('session_blocks')
        .insert({
          session_id: session.id,
          org_id: u.orgId,
          label: nextLabel,
          block_type: payload.block_type ?? 'main',
          format: payload.format ?? 'straight',
          sort_order: sort,
          notes: payload.notes ?? null,
        })
        .select('id')
        .single()
      if (blockErr) throw blockErr
      const blockId = newBlock.id

      const list = Array.isArray(payload.exercises) ? payload.exercises : []
      if (!list.length) return newBlock

      let sortOrder = 0
      for (const ex of list) {
        let exerciseId = ex.exercise_id
        if (!exerciseId && ex.exercise_name) {
          const { data: found, error: lookupErr } = await supabase
            .from('exercise_library')
            .select('id')
            .or(`org_id.is.null,org_id.eq.${u.orgId}`)
            .ilike('name', String(ex.exercise_name).trim())
            .limit(1)
            .maybeSingle()
          if (lookupErr) throw lookupErr
          if (!found?.id) {
            throw new Error(`Exercise "${ex.exercise_name}" not found in library`)
          }
          exerciseId = found.id
        }
        if (!exerciseId) {
          throw new Error('Each exercise in payload.exercises needs exercise_name or exercise_id')
        }

        const rawPt = ex.prescription_type
        const prescription_type =
          rawPt != null && String(rawPt).trim() !== ''
            ? resolvePrescriptionType(rawPt)
            : 'absolute'

        const { error: insErr } = await supabase.from('session_exercises').insert({
          block_id: blockId,
          org_id: u.orgId,
          exercise_id: exerciseId,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? null,
          prescription_type,
          prescription_value: ex.prescription_value ?? null,
          rest_seconds: ex.rest_seconds ?? null,
          tempo: ex.tempo ?? null,
          sort_order: sortOrder++,
          coach_note: ex.coach_note ?? null,
        })
        if (insErr) throw insErr
      }

      return newBlock
    })

    registerAction('clear_session_blocks', async () => {
      if (!canEditSession) {
        throw new Error('This session cannot be edited (published or insufficient permission).')
      }
      const u = getCurrentUser()
      const { error } = await supabase
        .from('session_blocks')
        .delete()
        .eq('session_id', session.id)
        .eq('org_id', u.orgId)
      if (error) throw error
    })

    return () => {
      unregisterAction('add_exercise_to_block')
      unregisterAction('change_prescription')
      unregisterAction('add_block')
      unregisterAction('clear_session_blocks')
    }
  }, [session, blocks, user.orgId, canEditSession])

  useEffect(() => {
    const h = (e) => {
      if (e.detail?.pageKey !== 'session_builder') return
      void reload()
    }
    window.addEventListener(ASSISTANT_ACTION_COMPLETE, h)
    return () => window.removeEventListener(ASSISTANT_ACTION_COMPLETE, h)
  }, [reload])

  if (loading) return <div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading session…</div>
  if (error || !session) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--color-danger)' }}>{error || 'Not found'}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SessionBuilderLeft session={session} programmeId={programmeId} />
        <section style={{ flex: 1, padding: 'var(--space-container)', overflow: 'auto', position: 'relative' }}>
          {toast && (
            <div
              role="status"
              style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                background: 'var(--color-surface-highest)',
                border: '1px solid var(--color-border)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                zIndex: 200,
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-body-sm)',
              }}
            >
              {toast}
            </div>
          )}
          <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/programmes/${programmeId}`)} role="link" tabIndex={0} onKeyDown={() => {}}>
              {crumb.programmeName}
            </span>
            <span aria-hidden> › </span>
            {session.programme_week_id ? (
              <span
                style={{ cursor: 'pointer' }}
                role="link"
                tabIndex={0}
                onClick={() =>
                  navigate(`/programmes/${programmeId}?week=${encodeURIComponent(session.programme_week_id)}`)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/programmes/${programmeId}?week=${encodeURIComponent(session.programme_week_id)}`)
                  }
                }}
              >
                Week {crumb.weekN}
              </span>
            ) : (
              <span>Week {crumb.weekN}</span>
            )}
            <span aria-hidden> › </span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>{crumb.dayLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            {canEditSession ? (
              <input
                className="sc-display"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveSessionTitle()}
                style={{
                  flex: 1,
                  minWidth: 200,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  font: 'inherit',
                }}
              />
            ) : (
              <h1 className="sc-display" style={{ margin: 0 }}>
                {session.name}
              </h1>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-size-label)',
                  fontWeight: 'var(--font-weight-semibold)',
                  textTransform: 'uppercase',
                  background: session.is_published ? 'rgba(52, 199, 89, 0.15)' : 'var(--color-surface-high)',
                  color: session.is_published ? 'var(--color-success)' : 'var(--color-text-muted)',
                }}
              >
                {session.is_published ? 'Published' : 'Unpublished'}
              </span>
              {canManageProgramme && (
                <button type="button" style={btnOutlineSm} onClick={() => void togglePublish()}>
                  {session.is_published ? 'Unpublish session' : 'Publish session'}
                </button>
              )}
            </div>
          </div>
          {session.is_published && canManageProgramme ? (
            <p className="sc-body-sm" style={{ margin: '8px 0 0', color: 'var(--color-text-muted)' }}>
              This session is published and locked. Unpublish to make changes.
            </p>
          ) : null}

          <label className="sc-label-caps" style={{ display: 'block', marginTop: 20 }}>
            Coach instructions
          </label>
          <textarea
            value={coachInstructions}
            onChange={(e) => setCoachInstructions(e.target.value)}
            disabled={!canEditSession}
            onBlur={async (e) => {
              if (!canEditSession) return
              try {
                const { error } = await supabase
                  .from('sessions')
                  .update({ coach_instructions: e.target.value || null })
                  .eq('id', session.id)
                  .eq('org_id', user.orgId)
                if (error) throw error
              } catch (err) {
                console.error('[SessionBuilder]', err)
              }
            }}
            rows={3}
            placeholder="General cues for the session…"
            style={{
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 'var(--radius-default)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />

          <SessionBuilderBlocksList
            blocks={blocks}
            selectedExercise={selectedExercise}
            selectedExerciseId={selectedExerciseId}
            onSelectExerciseRow={selectExerciseRow}
            orgId={user.orgId}
            onReload={reload}
            onDeleteExercise={deleteExercise}
            onToggleSupersetLink={toggleSupersetLink}
            onApplyExerciseLayout={applyExerciseLayout}
            onApplyBlockOrder={applyBlockOrder}
            onOpenSearch={(blockId) => {
              if (!canEditSession) return
              setAddForBlockId(blockId)
              setSearchOpen(true)
            }}
            onAddBlock={addBlock}
            canEdit={canEditSession}
          />
        </section>
        <aside
          style={{
            width: 'var(--session-builder-right)',
            flexShrink: 0,
            borderLeft: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            padding: 'var(--space-container)',
            overflow: 'auto',
          }}
        >
          {searchOpen ? (
            <SessionExerciseSearch
              onClose={() => {
                setSearchOpen(false)
                setAddForBlockId(null)
              }}
              onPick={(row) => void addExercise(row)}
              onNewExercise={() => window.alert('Org exercise creation — use AIS exercise flow later')}
            />
          ) : (
            <SessionInfoPanel
              exerciseRow={selectedExercise}
              orgId={user.orgId}
              athleteNames={athleteNames}
              oneRmByAthleteExercise={oneRmByAthleteExercise}
              sessionTeamId={rosterTeamId ?? session?.team_id ?? null}
              athleteLoadsMessage={athleteLoadsMessage}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
