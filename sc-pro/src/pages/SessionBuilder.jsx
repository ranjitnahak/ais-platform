import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { can, getCurrentUser } from '../lib/auth.js'
import { useSessionData } from '../hooks/useSessionData.js'
import { useSessionBuilderCrumb } from '../hooks/useSessionBuilderCrumb.js'
import SessionBuilderLeft from '../components/session/SessionBuilderLeft.jsx'
import SessionInfoPanel from '../components/SessionInfoPanel.jsx'
import SessionExerciseSearch from '../components/session/SessionExerciseSearch.jsx'
import SessionBuilderBlocksList from '../components/session/SessionBuilderBlocksList.jsx'
import { btnOutlineSm } from '../lib/sessionBuilderUi.js'

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
    athleteNames,
    oneRmByAthleteExercise,
    athleteLoadsMessage,
    rosterTeamId,
  } = useSessionData(sessionId)
  const crumb = useSessionBuilderCrumb(session, user.orgId)
  const [title, setTitle] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [addForBlockId, setAddForBlockId] = useState(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState(null)
  const [toast, setToast] = useState(null)
  const canManageProgramme = can('programme', 'edit')
  const canEditSession = canManageProgramme && !session?.is_published

  useEffect(() => {
    if (session?.name) setTitle(session.name)
  }, [session?.id, session?.name])

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
        setSearchOpen(false)
        setAddForBlockId(null)
        await reload()
      } catch (e) {
        console.error('[SessionBuilder]', e)
      }
    },
    [addForBlockId, blocks, user.orgId, reload, canEditSession],
  )

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
            defaultValue={session.coach_instructions || ''}
            key={session.id}
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
