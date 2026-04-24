import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { can } from '../../lib/auth.js'
import { blockHasLinkedSupersets, sortedExercises, supersetRowMeta } from '../../lib/sessionBuilderExerciseUtils.js'
import { addBlockBtn, formatPill } from '../../lib/sessionBuilderUi.js'
import SessionBuilderExerciseRow from './SessionBuilderExerciseRow.jsx'

const FMT_LABELS = {
  straight: 'Straight sets',
  superset: 'Supersets',
  circuit: 'Circuit',
  emom: 'EMOM',
  amrap: 'AMRAP',
  custom: 'Custom',
}

const APPEND_PREFIX = 'append:'

function appendDroppableId(blockId) {
  return `${APPEND_PREFIX}${blockId}`
}

function isAppendDroppableId(id) {
  return String(id).startsWith(APPEND_PREFIX)
}

function parseAppendBlockId(id) {
  return String(id).slice(APPEND_PREFIX.length)
}

function itemsByBlockFromProps(blocks) {
  const m = {}
  for (const b of blocks) {
    m[b.id] = sortedExercises(b).map((e) => e.id)
  }
  return m
}

function findExerciseById(blocks, exerciseId) {
  for (const b of blocks) {
    for (const ex of b.session_exercises || []) {
      if (ex.id === exerciseId) return ex
    }
  }
  return null
}

/**
 * @param {Record<string, string[]>} itemsByBlock
 * @returns {Record<string, string[]> | null}
 */
function computeNextItemsByBlock(itemsByBlock, activeId, over) {
  if (!over) return null
  const activeC = Object.keys(itemsByBlock).find((bid) => itemsByBlock[bid].includes(activeId))
  if (!activeC) return null

  let overC
  let overIndex
  if (isAppendDroppableId(over.id)) {
    overC = parseAppendBlockId(over.id)
    const len = (itemsByBlock[overC] || []).length
    overIndex = activeC === overC && len > 0 ? len - 1 : len
  } else {
    overC = Object.keys(itemsByBlock).find((bid) => itemsByBlock[bid].includes(over.id))
    if (!overC) return null
    overIndex = itemsByBlock[overC].indexOf(over.id)
    if (overIndex < 0) return null
  }

  const activeIndex = itemsByBlock[activeC].indexOf(activeId)
  if (activeIndex < 0) return null

  if (activeC === overC) {
    if (activeIndex === overIndex) return null
    return {
      ...itemsByBlock,
      [activeC]: arrayMove([...itemsByBlock[activeC]], activeIndex, overIndex),
    }
  }

  const fromArr = [...itemsByBlock[activeC]]
  const [moved] = fromArr.splice(activeIndex, 1)
  const toArr = [...itemsByBlock[overC]]
  toArr.splice(overIndex, 0, moved)
  return { ...itemsByBlock, [activeC]: fromArr, [overC]: toArr }
}

function BlockAppendDropZone({ blockId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: appendDroppableId(blockId),
    data: { type: 'append', blockId },
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 14,
        marginTop: 2,
        borderRadius: 'var(--radius-sm)',
        background: isOver ? 'var(--color-primary-soft)' : 'transparent',
        border: isOver ? '1px dashed var(--color-primary)' : '1px dashed transparent',
      }}
    />
  )
}

function ExerciseDragPreview({ ex }) {
  const lib = ex.exercise_library
  const summary =
    ex.prescription_type === 'pct_1rm'
      ? `${ex.sets ?? '—'} × ${ex.reps ?? '—'} @ ${ex.prescription_value ?? '—'}%`
      : `${ex.sets ?? '—'} × ${ex.reps ?? '—'}`
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface-high)',
        border: '1px solid var(--color-primary)',
        boxShadow: '0 8px 20px var(--color-surface-highest)',
        cursor: 'grabbing',
        color: 'var(--color-text)',
        maxWidth: 480,
      }}
    >
      <span style={{ color: 'var(--color-text-muted)' }} aria-hidden>
        ⠿
      </span>
      <span style={{ flex: 1, fontWeight: 'var(--font-weight-semibold)' }}>{lib?.name || 'Exercise'}</span>
      <span
        style={{
          color: ex.prescription_type === 'pct_1rm' ? 'var(--color-primary)' : 'var(--color-text-muted)',
          fontSize: 'var(--font-size-body-sm)',
        }}
      >
        {summary}
      </span>
    </div>
  )
}

export default function SessionBuilderBlocksList({
  blocks,
  selectedExercise,
  selectedExerciseId,
  onSelectExerciseRow,
  orgId,
  onReload,
  onDeleteExercise,
  onToggleSupersetLink,
  onApplyExerciseLayout,
  onOpenSearch,
  onAddBlock,
}) {
  const canEdit = can('programme', 'edit')
  const [activeId, setActiveId] = useState(null)
  const [hoveredRowId, setHoveredRowId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveId(null)
      if (!over || !can('programme', 'edit')) return

      const prev = itemsByBlockFromProps(blocks)
      const next = computeNextItemsByBlock(prev, active.id, over)
      if (!next) return

      const layoutSig = (m) => blocks.map((b) => `${b.id}:${(m[b.id] || []).join(',')}`).join('|')
      if (layoutSig(prev) === layoutSig(next)) return

      const layout = blocks.map((b) => ({
        blockId: b.id,
        exerciseIds: next[b.id] || [],
      }))
      void onApplyExerciseLayout?.(layout)
    },
    [blocks, onApplyExerciseLayout],
  )

  const activeExercise = activeId ? findExerciseById(blocks, activeId) : null

  const inner = (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((b) => {
        const sorted = sortedExercises(b)
        const ids = sorted.map((e) => e.id)
        const linkedSupersets = blockHasLinkedSupersets(b)
        const formatPillLabel = linkedSupersets ? 'Supersets' : FMT_LABELS[b.format] || b.format
        return (
          <div
            key={b.id}
            onDragLeave={(e) => {
              const next = e.relatedTarget
              if (!next || !e.currentTarget.contains(next)) setHoveredRowId(null)
            }}
            style={{
              border:
                selectedExercise && b.session_exercises?.some((e) => e.id === selectedExercise.id)
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
              padding: 'var(--space-pad-x)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'var(--font-weight-bold)',
                  fontSize: 12,
                }}
              >
                {b.label}
              </div>
              <span style={{ fontWeight: 'var(--font-weight-semibold)', textTransform: 'uppercase' }}>Block</span>
              <span style={formatPill}>{formatPillLabel}</span>
              {selectedExercise && b.session_exercises?.some((e) => e.id === selectedExercise.id) && (
                <span className="sc-label-caps" style={{ color: 'var(--color-primary)' }}>
                  Editing
                </span>
              )}
            </div>
            {canEdit ? (
              <SortableContext id={b.id} items={ids} strategy={verticalListSortingStrategy}>
                {sorted.map((ex, idx) => (
                  <SessionBuilderExerciseRow
                    key={ex.id}
                    ex={ex}
                    blockId={b.id}
                    sorted={sorted}
                    idx={idx}
                    isLast={idx === sorted.length - 1}
                    selectedExerciseId={selectedExerciseId}
                    onSelectExerciseRow={onSelectExerciseRow}
                    hoveredRowId={hoveredRowId}
                    setHoveredRowId={setHoveredRowId}
                    onDeleteExercise={onDeleteExercise}
                    onToggleSupersetLink={onToggleSupersetLink}
                    orgId={orgId}
                    canEdit={canEdit}
                    onReload={onReload}
                  />
                ))}
                <BlockAppendDropZone blockId={b.id} />
              </SortableContext>
            ) : (
              <>
                {sorted.map((ex, idx) => {
                  const lib = ex.exercise_library
                  const act = ex.id === selectedExerciseId
                  const summary =
                    ex.prescription_type === 'pct_1rm'
                      ? `${ex.sets ?? '—'} × ${ex.reps ?? '—'} @ ${ex.prescription_value ?? '—'}%`
                      : `${ex.sets ?? '—'} × ${ex.reps ?? '—'}`
                  const { showRail } = supersetRowMeta(sorted, idx)
                  return (
                    <div
                      key={ex.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectExerciseRow?.(ex.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectExerciseRow?.(ex.id)
                        }
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 6px',
                        borderBottom: idx < sorted.length - 1 ? '1px solid var(--color-border)' : 'none',
                        background: act ? 'var(--color-primary-soft)' : 'transparent',
                        borderRadius: act ? 'var(--radius-md)' : 0,
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        outline: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: showRail ? 2 : 0,
                          flexShrink: 0,
                          alignSelf: 'stretch',
                          marginRight: showRail ? 4 : 0,
                          background: showRail ? 'var(--color-primary)' : 'transparent',
                          borderRadius: 1,
                        }}
                        aria-hidden
                      />
                      <span style={{ width: 26, flexShrink: 0 }} aria-hidden />
                      <span style={{ color: 'var(--color-text-muted)', width: 20 }} aria-hidden>
                        ⠿
                      </span>
                      <span className="sc-body-sm" style={{ color: 'var(--color-text-muted)', width: 22 }}>
                        {idx + 1}.
                      </span>
                      <span style={{ flex: 1 }}>{lib?.name || 'Exercise'}</span>
                      <span
                        style={{
                          color: ex.prescription_type === 'pct_1rm' ? 'var(--color-primary)' : 'var(--color-text)',
                          fontSize: 'var(--font-size-body-sm)',
                        }}
                      >
                        {summary}
                      </span>
                      <span style={{ width: 26, flexShrink: 0 }} aria-hidden />
                      <span style={{ color: 'var(--color-text-muted)' }}>›</span>
                    </div>
                  )
                })}
              </>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => onOpenSearch(b.id)}
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                + Add exercise
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  if (!canEdit) {
    return (
      <>
        {inner}
        <button type="button" onClick={() => void onAddBlock()} style={{ ...addBlockBtn, marginTop: 12 }}>
          + Add block
        </button>
      </>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {inner}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
        {activeExercise ? <ExerciseDragPreview ex={activeExercise} /> : null}
      </DragOverlay>
      <button type="button" onClick={() => void onAddBlock()} style={{ ...addBlockBtn, marginTop: 12 }}>
        + Add block
      </button>
    </DndContext>
  )
}
