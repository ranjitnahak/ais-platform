import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { can } from '../lib/auth.js'
import { supabase } from '../lib/supabaseClient.js'
import { PHASE_BADGE } from '../lib/programmeUi.js'
import AssignProgrammeModal from '../components/AssignProgrammeModal.jsx'
import { useProgrammeDetailPage } from '../hooks/useProgrammeDetailPage.js'
import { deepCopyWeek } from '../lib/programmeWeeklyCopy.js'
import { SESSION_CATS, badgeBase, btnOutline, btnPrimary } from '../lib/programmeSessionUi.js'
import CreateSessionModal from '../components/programme-detail/CreateSessionModal.jsx'
import CopyWeekModal from '../components/programme-detail/CopyWeekModal.jsx'
import SessionPreviewPanel from '../components/SessionPreviewPanel.jsx'
import WeeklySessionGrid from '../components/programme-detail/WeeklySessionGrid.jsx'
import SessionSelectionBar from '../components/SessionSelectionBar.jsx'
import { useSessionSelection } from '../hooks/useSessionSelection.js'

export default function ProgrammeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()
  const v = useProgrammeDetailPage(id)
  const [assignOpen, setAssignOpen] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState(null)
  const [copyWeekBusy, setCopyWeekBusy] = useState(false)
  const copyWeekLockRef = useRef(false)

  useEffect(() => {
    setPreviewSessionId(null)
  }, [location.pathname])

  useEffect(() => {
    if (!v.copiedSession) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      v.dismissSessionClipboard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [v.copiedSession, v.dismissSessionClipboard])

  const weekSessionIds = useMemo(
    () => (v.links ?? []).map((r) => r.session_id ?? r.sessions?.id).filter(Boolean),
    [v.links],
  )

  const selection = useSessionSelection({
    user: v.user,
    weekId: v.weekId,
    weekSessionIds,
    refreshWeek: v.refreshWeek,
    setToast: v.setToast,
    dismissSingleClipboard: v.dismissSessionClipboard,
  })

  const selectionCount = selection.selectedSessionIds.size
  const showSelectionBar = can('programme', 'edit') && selectionCount > 0
  const bulkPasteActive = selection.bulkPasteQueueLength > 0
  const bottomChromePadding = showSelectionBar ? 170 : bulkPasteActive ? 130 : 100

  if (v.loading) return <div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</div>
  if (v.error || !v.programme) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--color-danger)' }}>{v.error || 'Not found'}</p>
        <Link to="/programmes" style={{ color: 'var(--color-primary)' }}>
          Back to library
        </Link>
      </div>
    )
  }

  const programme = v.programme
  const phaseKey = PHASE_BADGE[programme.phase_type] ? programme.phase_type : 'general'

  return (
    <div style={{ padding: 'var(--space-container)', paddingBottom: bottomChromePadding }}>
      {(v.clipboardToast || v.toast) && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'flex-end',
            zIndex: 200,
            maxWidth: 360,
          }}
        >
          {v.clipboardToast ? (
            <div
              data-clipboard-toast
              style={{
                background: 'var(--color-surface-highest)',
                border: '1px solid var(--color-border)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-body-sm)',
              }}
            >
              {v.clipboardToast}
            </div>
          ) : null}
          {v.toast ? (
            <div
              style={{
                background: 'var(--color-surface-highest)',
                border: '1px solid var(--color-border)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-body-sm)',
              }}
            >
              {v.toast}
            </div>
          ) : null}
        </div>
      )}
      <div className="sc-body-sm" style={{ marginBottom: 12 }}>
        <Link to="/programmes" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          Programmes
        </Link>
        <span style={{ color: 'var(--color-text-muted)' }}> › </span>
        <span style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>{programme.name}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <h1 className="sc-headline" style={{ margin: 0, flex: '1 1 200px' }}>
          {programme.name}
        </h1>
        <span style={{ ...badgeBase, ...PHASE_BADGE[phaseKey] }}>{phaseKey}</span>
        {programme.sport && (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-high)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-body-sm)',
            }}
          >
            {programme.sport}
          </span>
        )}
        {v.assignPill?.type === 'team' && (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-high)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-body-sm)',
            }}
          >
            {v.assignPill.name}
          </span>
        )}
        {v.assignPill?.type === 'athlete' && (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--color-phase-intensification)',
              fontSize: 'var(--font-size-body-sm)',
            }}
          >
            {v.assignPill.name}
          </span>
        )}
        <button type="button" style={btnOutline} onClick={() => setAssignOpen(true)}>
          Assign
        </button>
        <button type="button" style={btnOutline} onClick={() => void v.saveTemplate()}>
          Save as Template
        </button>
      </div>

      <div
        data-programme-week-nav
        style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8, borderBottom: '1px solid var(--color-border)' }}
      >
        {v.weeks.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => {
              v.setWeekId(w.id)
              setSearchParams({ week: w.id }, { replace: true })
            }}
            style={{
              padding: '10px 14px',
              border: 'none',
              borderBottom: w.id === v.weekId ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'transparent',
              color: w.id === v.weekId ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: w.id === v.weekId ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Week {w.week_number}
            {v.weekIdsWithSessions.includes(w.id) && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>•</span>
            )}
          </button>
        ))}
      </div>

      {v.selectedWeek && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
            {v.selectedWeek.label || `Week ${v.selectedWeek.week_number}`}
          </span>
          <span style={{ color: 'var(--color-text-muted)' }} aria-hidden>
            📝
          </span>
        </div>
      )}

      <WeeklySessionGrid
        dayCols={v.dayCols}
        sessionsByDay={v.sessionsByDay}
        counts={v.counts}
        programmeId={id}
        navigate={navigate}
        onAddSession={(iso) => v.setCreateOpen({ session_date: iso })}
        canEdit={can('programme', 'edit')}
        onMoveSession={v.moveSessionToDay}
        onReorderSessionsForDay={v.reorderSessionsForDay}
        onPreviewSession={(sessionId) => setPreviewSessionId(sessionId)}
        clipboardSessionName={can('programme', 'edit') ? (v.copiedSession?.session?.name ?? null) : null}
        onCopySessionToClipboard={v.copySessionToClipboard}
        onPasteCopiedSession={v.pasteCopiedSessionToDate}
        onPasteSlot={(iso) => selection.tryPasteBulkSlot(iso)}
        bulkPasteQueueLength={selection.bulkPasteQueueLength}
        onToggleSessionPublish={v.toggleSessionPublish}
        onSaveSessionToLibraryStub={v.saveSessionToLibraryStub}
        onRepeatSessionToDate={v.repeatSessionToDate}
        onDeleteSession={v.deleteSession}
        selectedSessionIds={selection.selectedSessionIds}
        onToggleSelect={selection.toggleSessionInSelection}
        onGridBackgroundPointerUp={selection.onGridBackgroundPointerUp}
        onSelectAllSessions={selection.selectAllInWeek}
      />

      {previewSessionId ? (
        <SessionPreviewPanel
          sessionId={previewSessionId}
          programmeId={id}
          orgId={v.user.orgId}
          onClose={() => setPreviewSessionId(null)}
        />
      ) : null}

      {showSelectionBar ? (
        <SessionSelectionBar
          count={selectionCount}
          busy={selection.barBusy}
          deleteConfirm={selection.barDeleteConfirm}
          onPublishAll={selection.publishAllSelected}
          onCopy={selection.copyAllSelected}
          onDelete={() => selection.setBarDeleteConfirm(true)}
          onDismiss={selection.clearSelection}
          onCancelDelete={() => selection.setBarDeleteConfirm(false)}
          onConfirmDelete={selection.confirmDeleteSelected}
        />
      ) : null}

      <div
        data-programme-detail-footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 'var(--sidebar-width)',
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px var(--space-container)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface-low)',
          zIndex: 90,
        }}
      >
        <button type="button" style={btnOutline} onClick={() => v.setCopyOpen(true)}>
          Copy Week
        </button>
        <button type="button" style={btnPrimary} onClick={() => window.alert('Assign week to athletes — coming soon')}>
          + Assign Week to Athletes
        </button>
      </div>

      {v.createOpen && (
        <CreateSessionModal
          initial={v.createOpen}
          categories={SESSION_CATS}
          onClose={() => v.setCreateOpen(null)}
          onSave={v.createSession}
        />
      )}
      {assignOpen && (
        <AssignProgrammeModal
          programmeId={id}
          orgId={v.user.orgId}
          onClose={() => setAssignOpen(false)}
          onSuccess={(msg) => {
            v.setToast(msg)
            setAssignOpen(false)
            void v.load()
          }}
        />
      )}
      {v.copyOpen && (
        <CopyWeekModal
          emptyWeeks={v.emptyWeekTargets}
          busy={copyWeekBusy}
          onClose={() => {
            if (!copyWeekBusy) v.setCopyOpen(false)
          }}
          onConfirm={async (targetWeekId) => {
            if (copyWeekLockRef.current) return
            copyWeekLockRef.current = true
            setCopyWeekBusy(true)
            try {
              await deepCopyWeek({
                supabase,
                user: v.user,
                programme,
                sourceWeekId: v.weekId,
                targetWeekId,
                weeks: v.weeks,
              })
              v.setCopyOpen(false)
              v.setToast('Week copied successfully')
              v.setWeekId(targetWeekId)
            } catch (e) {
              console.error('[ProgrammeDetail] copy', e)
              v.setToast(e.message ?? 'Copy failed')
            } finally {
              copyWeekLockRef.current = false
              setCopyWeekBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}
