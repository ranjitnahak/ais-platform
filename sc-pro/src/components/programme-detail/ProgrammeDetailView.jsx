import { Link, useNavigate } from 'react-router-dom'
import { can } from '../../lib/auth.js'
import { DIFF_BADGE, PHASE_BADGE } from '../../lib/programmeUi.js'
import { weekOneMondayIso } from '../../lib/weekDates.js'
import { badgeBase, btnOutline, btnPrimary } from '../../lib/programmeSessionUi.js'
import SessionPreviewPanel from '../SessionPreviewPanel.jsx'
import WeeklySessionGrid from './WeeklySessionGrid.jsx'
import SessionSelectionBar from '../SessionSelectionBar.jsx'
import ProgrammeDetailModals from './ProgrammeDetailModals.jsx'
import { IconButton, MenuItem } from '../programmes/programmeLibraryUi.jsx'

export default function ProgrammeDetailView({
  v,
  programme,
  programmeId: id,
  setSearchParams,
  nameDraft,
  setNameDraft,
  nameBusy,
  saveName,
  bottomChromePadding,
  assignOpen,
  setAssignOpen,
  previewSessionId,
  setPreviewSessionId,
  copyWeekBusy,
  setCopyWeekBusy,
  copyWeekLockRef,
  headerMenuOpen,
  setHeaderMenuOpen,
  editDetailsOpen,
  setEditDetailsOpen,
  settingsBusy,
  setSettingsBusy,
  selection,
  selectionCount,
  showSelectionBar,
}) {
  const navigate = useNavigate()
  const phaseKey = PHASE_BADGE[programme.phase_type] ? programme.phase_type : 'general'
  const diffKey = DIFF_BADGE[programme.difficulty] ? programme.difficulty : 'moderate'
  const week1Iso = weekOneMondayIso(programme)
  const week1Label = week1Iso
    ? new Date(`${week1Iso}T12:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

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
        {can('programme', 'edit') ? (
          <input
            className="sc-headline"
            value={nameDraft}
            disabled={nameBusy}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void saveName()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setNameDraft(programme.name || '')
              }
            }}
            style={{
              margin: 0,
              flex: '1 1 200px',
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--color-text)',
              outline: 'none',
              minWidth: 220,
              padding: 0,
            }}
            aria-label="Programme name"
          />
        ) : (
          <h1 className="sc-headline" style={{ margin: 0, flex: '1 1 200px' }}>
            {programme.name}
          </h1>
        )}
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
        {(v.assignTargets?.teams ?? []).map((t) => (
          <span
            key={t.id}
            style={{
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-high)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-body-sm)',
            }}
          >
            {t.name}
          </span>
        ))}
        {(v.assignTargets?.athletes ?? []).map((a) => (
          <span
            key={a.id}
            style={{
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--color-phase-intensification)',
              fontSize: 'var(--font-size-body-sm)',
            }}
          >
            {a.name}
          </span>
        ))}
        {can('programme', 'edit') && ((v.assignTargets?.teams?.length ?? 0) > 0 || (v.assignTargets?.athletes?.length ?? 0) > 0) && (
          <button type="button" style={btnOutline} onClick={() => void v.clearProgrammeAssignments()}>
            Clear assignments
          </button>
        )}
        <button type="button" style={btnOutline} onClick={() => setAssignOpen(true)}>
          Assign
        </button>
        {can('programme', 'edit') ? (
          <span data-programme-header-menu style={{ position: 'relative' }}>
            <IconButton label="Programme options" onClick={() => setHeaderMenuOpen((o) => !o)} icon="dots" />
            {headerMenuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: 6,
                  minWidth: 210,
                  background: 'var(--color-surface-highest)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  zIndex: 95,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <MenuItem
                  onClick={() => {
                    setHeaderMenuOpen(false)
                    setEditDetailsOpen(true)
                  }}
                >
                  Edit programme overview
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setHeaderMenuOpen(false)
                    void v.saveTemplate()
                  }}
                >
                  Save as Template
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setHeaderMenuOpen(false)
                    v.setToast('Archive — coming soon')
                  }}
                >
                  Archive
                </MenuItem>
              </div>
            ) : null}
          </span>
        ) : (
          <button type="button" style={btnOutline} onClick={() => void v.saveTemplate()}>
            Save as Template
          </button>
        )}
      </div>

      <div
        className="sc-body-sm"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 16,
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Training age: {programme.training_age ?? '—'}</span>
        <span style={{ ...badgeBase, ...DIFF_BADGE[diffKey] }}>{diffKey.replace('_', ' ')}</span>
        {week1Label ? <span>Week 1 starts {week1Label}</span> : null}
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

      <ProgrammeDetailModals
        v={v}
        programme={programme}
        programmeId={id}
        assignOpen={assignOpen}
        setAssignOpen={setAssignOpen}
        copyWeekBusy={copyWeekBusy}
        setCopyWeekBusy={setCopyWeekBusy}
        copyWeekLockRef={copyWeekLockRef}
        editDetailsOpen={editDetailsOpen}
        setEditDetailsOpen={setEditDetailsOpen}
        settingsBusy={settingsBusy}
        setSettingsBusy={setSettingsBusy}
      />
    </div>
  )
}
