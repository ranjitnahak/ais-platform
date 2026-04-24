import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import ProgrammeWeekSessionCard from './ProgrammeWeekSessionCard.jsx'
import {
  SESS_DROP_PREFIX,
  dayColumnShellStyle,
  parseSessionDragId,
  parseSessionDropTargetId,
  resolveTargetDayIso,
  sessionDateIso,
} from './weeklySessionGridDnd.js'
import {
  DayDropColumnDnd,
  DragSessionPreview,
  DraggableWeekSessionCard,
  EmptyDaySlotButton,
} from './weeklySessionGridParts.jsx'

export default function WeeklySessionGrid({
  dayCols,
  sessionsByDay,
  counts,
  programmeId,
  navigate,
  onAddSession,
  canEdit = false,
  onMoveSession,
  onReorderSessionsForDay,
  onPreviewSession,
  clipboardSessionName = null,
  onCopySessionToClipboard,
  onPasteCopiedSession,
  onPasteSlot,
  bulkPasteQueueLength = 0,
  onToggleSessionPublish,
  onSaveSessionToLibraryStub,
  onRepeatSessionToDate,
  onDeleteSession,
  selectedSessionIds,
  onToggleSelect,
  onGridBackgroundPointerUp,
  onSelectAllSessions,
}) {
  const [dragSession, setDragSession] = useState(null)
  const gridWrapRef = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const findSessionById = useCallback(
    (sid) => {
      for (const d of dayCols) {
        for (const { session } of sessionsByDay[d.iso] ?? []) {
          if (session.id === sid) return session
        }
      }
      return null
    },
    [dayCols, sessionsByDay],
  )

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (canEdit && over) {
        const sessionId = parseSessionDragId(active.id)
        if (sessionId) {
          const overSessionId = parseSessionDropTargetId(over.id)
          const targetIso = resolveTargetDayIso(over.id, sessionsByDay, dayCols)
          const session = findSessionById(sessionId)
          const curIso = session ? sessionDateIso(session) : null
          if (curIso && overSessionId && overSessionId !== sessionId && curIso === targetIso) {
            const dayList = sessionsByDay[curIso] ?? []
            const ids = dayList.map(({ session: s }) => s.id)
            const oldIdx = ids.indexOf(sessionId)
            const newIdx = ids.indexOf(overSessionId)
            if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
              onReorderSessionsForDay?.(curIso, arrayMove(ids, oldIdx, newIdx))
            }
          } else if (targetIso && curIso && curIso !== targetIso) {
            onMoveSession?.(sessionId, targetIso)
          }
        }
      }
      setDragSession(null)
    },
    [canEdit, dayCols, findSessionById, onMoveSession, onReorderSessionsForDay, sessionsByDay],
  )

  const handleDragCancel = useCallback(() => {
    setDragSession(null)
  }, [])

  const collisionDetection = useMemo(
    () => (args) => {
      const pointerHits = pointerWithin(args)
      if (pointerHits.length) {
        const sessionHit = pointerHits.find((c) => String(c.id).startsWith(SESS_DROP_PREFIX))
        if (sessionHit) return [sessionHit]
        return pointerHits
      }
      return closestCorners(args)
    },
    [],
  )

  const selSet = selectedSessionIds
  const selectionActive = Boolean(selSet && selSet.size > 0)

  const renderSessionCard = (session) => {
    const isSelected = selSet?.has(session.id) ?? false
    const dim = selectionActive && !isSelected
    return canEdit ? (
      <DraggableWeekSessionCard
        key={session.id}
        session={session}
        counts={counts}
        programmeId={programmeId}
        navigate={navigate}
        canEdit
        onPreview={onPreviewSession}
        dayCols={dayCols}
        onToggleSessionPublish={onToggleSessionPublish}
        onSaveSessionToLibraryStub={onSaveSessionToLibraryStub}
        onRepeatSessionToDate={onRepeatSessionToDate}
        onCopySessionToClipboard={onCopySessionToClipboard}
        onDeleteSession={onDeleteSession}
        isSelected={isSelected}
        selectionDimmed={dim}
        selectionActive={selectionActive}
        onToggleSelect={onToggleSelect}
      />
    ) : (
      <ProgrammeWeekSessionCard
        key={session.id}
        session={session}
        counts={counts}
        programmeId={programmeId}
        navigate={navigate}
        canEdit={false}
        onPreview={onPreviewSession}
        dayCols={dayCols}
        onToggleSessionPublish={onToggleSessionPublish}
        onSaveSessionToLibraryStub={onSaveSessionToLibraryStub}
        onRepeatSessionToDate={onRepeatSessionToDate}
        onCopySessionToClipboard={onCopySessionToClipboard}
        onDeleteSession={onDeleteSession}
        isSelected={isSelected}
        selectionDimmed={dim}
        selectionActive={selectionActive}
      />
    )
  }

  const gridBody = (
    <div
      ref={gridWrapRef}
      tabIndex={canEdit ? 0 : -1}
      onKeyDown={(e) => {
        if (!canEdit || !onSelectAllSessions) return
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
          e.preventDefault()
          onSelectAllSessions()
        }
      }}
      onPointerUp={onGridBackgroundPointerUp}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 'var(--space-gutter)',
        minHeight: 320,
        outline: 'none',
      }}
    >
      {dayCols.map((d) => (
        <div key={d.iso}>
          <div className="sc-label-caps" style={{ marginBottom: 4 }}>
            {d.dow}
          </div>
          <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
            {d.display}
          </div>
          {canEdit ? (
            <DayDropColumnDnd iso={d.iso}>
              {(sessionsByDay[d.iso] ?? []).map(({ session }) => renderSessionCard(session))}
              <EmptyDaySlotButton
                iso={d.iso}
                clipboardSessionName={clipboardSessionName}
                bulkPasteQueueLength={bulkPasteQueueLength}
                onAddSession={onAddSession}
                onPasteCopiedSession={onPasteCopiedSession}
                onPasteSlot={onPasteSlot}
              />
            </DayDropColumnDnd>
          ) : (
            <div style={dayColumnShellStyle}>
              {(sessionsByDay[d.iso] ?? []).map(({ session }) => renderSessionCard(session))}
              <EmptyDaySlotButton
                iso={d.iso}
                clipboardSessionName={clipboardSessionName}
                bulkPasteQueueLength={bulkPasteQueueLength}
                onAddSession={onAddSession}
                onPasteCopiedSession={onPasteCopiedSession}
                onPasteSlot={onPasteSlot}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )

  if (!canEdit) {
    return gridBody
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => {
        const sid = parseSessionDragId(active.id)
        setDragSession(sid ? findSessionById(sid) : null)
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {gridBody}
      <DragOverlay dropAnimation={null}>
        {dragSession ? <DragSessionPreview session={dragSession} counts={counts} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
