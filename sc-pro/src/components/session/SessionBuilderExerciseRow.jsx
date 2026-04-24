import { useCallback, useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import PrescriptionPillRow from '../PrescriptionPillRow.jsx'
import { formatPrescriptionSummary } from '../../lib/sessionPreviewFormat.js'
import { supersetRowMeta } from '../../lib/sessionBuilderExerciseUtils.js'
import { supabase } from '../../lib/supabaseClient.js'

const COACH_NOTE_MAX = 10000

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: 'block' }}>
      <path
        d="M9 3h6l1 2h5v2H3V5h5l1-2zm0 4h12l-1 14H10L9 7zm3 3v9m3-9v9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: 'block' }}>
      <path
        d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function SessionBuilderExerciseRow({
  ex,
  blockId,
  sorted,
  idx,
  isLast,
  selectedExerciseId,
  onSelectExerciseRow,
  hoveredRowId,
  setHoveredRowId,
  onDeleteExercise,
  onToggleSupersetLink,
  orgId,
  canEdit,
  onReload,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.id,
    data: { blockId },
  })
  const lib = ex.exercise_library
  const active = ex.id === selectedExerciseId
  const { showRail } = supersetRowMeta(sorted, idx)
  const rowHover = hoveredRowId === ex.id
  const [delHover, setDelHover] = useState(false)
  const [linkHover, setLinkHover] = useState(false)
  const [coachDraft, setCoachDraft] = useState('')
  const hasExpandableDetail = canEdit || !!(ex.coach_note != null && String(ex.coach_note).trim())
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setCoachDraft(ex.coach_note != null ? String(ex.coach_note) : '')
  }, [ex.id, ex.coach_note])

  const saveCoachNote = useCallback(async () => {
    if (!canEdit || !orgId || !ex?.id) return
    const trimmed = coachDraft.trim().slice(0, COACH_NOTE_MAX)
    const prev = ex.coach_note != null ? String(ex.coach_note).trim() : ''
    if (trimmed === prev) return
    try {
      const { error } = await supabase
        .from('session_exercises')
        .update({ coach_note: trimmed === '' ? null : trimmed })
        .eq('id', ex.id)
        .eq('org_id', orgId)
      if (error) throw error
      await onReload?.()
    } catch (err) {
      console.error('[SessionBuilderExerciseRow] coach_note', err)
    }
  }, [canEdit, coachDraft, ex?.id, ex.coach_note, orgId, onReload])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    width: '100%',
    minWidth: 0,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 6px',
    borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
    background: active ? 'var(--color-primary-soft)' : 'transparent',
    borderRadius: active ? 'var(--radius-md)' : 0,
    cursor: 'default',
    color: 'var(--color-text)',
    outline: 'none',
    position: 'relative',
  }

  const summary = formatPrescriptionSummary(ex)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="group"
      onMouseEnter={() => setHoveredRowId(ex.id)}
      onMouseLeave={() => setHoveredRowId(null)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectExerciseRow?.(ex.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectExerciseRow?.(ex.id)
          }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
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
        <button
          type="button"
          aria-label="Delete exercise"
          title="Delete exercise"
          onClick={(e) => {
            e.stopPropagation()
            void onDeleteExercise?.(ex.id)
          }}
          onMouseEnter={() => setDelHover(true)}
          onMouseLeave={() => setDelHover(false)}
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: rowHover ? 1 : 0,
            pointerEvents: rowHover ? 'auto' : 'none',
            color: delHover ? 'var(--color-danger)' : 'var(--color-text-muted)',
          }}
        >
          <IconTrash />
        </button>
        <span
          {...listeners}
          aria-label="Drag to reorder or move to another block"
          title="Drag to reorder or move to another block"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            color: 'var(--color-text-muted)',
            width: 20,
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          ⠿
        </span>
        <span className="sc-body-sm" style={{ color: 'var(--color-text-muted)', width: 22, flexShrink: 0 }}>
          {idx + 1}.
        </span>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 'var(--font-weight-semibold)' }}>{lib?.name || 'Exercise'}</span>
        {(!canEdit || !detailOpen) && (
          <span
            style={{
              color:
                ex.prescription_type === 'pct_1rm' ||
                ex.secondary_prescription_type === 'pct_1rm' ||
                ex.tertiary_prescription_type === 'pct_1rm'
                  ? 'var(--color-primary)'
                  : 'var(--color-text)',
              fontSize: 'var(--font-size-body-sm)',
              flexShrink: 0,
            }}
          >
            {summary}
          </span>
        )}
        {hasExpandableDetail ? (
          <button
            type="button"
            aria-expanded={detailOpen}
            aria-label={detailOpen ? 'Collapse exercise details' : 'Expand exercise details'}
            title={detailOpen ? 'Hide instructions and prescription' : 'Show instructions and prescription'}
            onClick={(e) => {
              e.stopPropagation()
              setDetailOpen((o) => !o)
            }}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                fontSize: 12,
                lineHeight: 1,
                transform: detailOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              ▾
            </span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label={ex.superset_group != null ? 'Unlink superset' : 'Link with next exercise (superset)'}
          title={ex.superset_group != null ? 'Unlink superset' : 'Link with next exercise'}
          onClick={(e) => {
            e.stopPropagation()
            void onToggleSupersetLink?.(blockId, ex.id, idx)
          }}
          onMouseEnter={() => setLinkHover(true)}
          onMouseLeave={() => setLinkHover(false)}
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: rowHover ? 1 : 0,
            pointerEvents: rowHover ? 'auto' : 'none',
            color: linkHover ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
        >
          <IconLink />
        </button>
      </div>
      {detailOpen && canEdit ? (
        <div
          style={{ paddingLeft: 52, paddingRight: 6, marginTop: 4 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label className="sc-label-caps" htmlFor={`coach-note-${ex.id}`} style={{ display: 'block', marginBottom: 4 }}>
            Exercise instructions
          </label>
          <textarea
            id={`coach-note-${ex.id}`}
            value={coachDraft}
            maxLength={COACH_NOTE_MAX}
            onChange={(e) => setCoachDraft(e.target.value)}
            onBlur={() => void saveCoachNote()}
            placeholder="Ex. Stay tight. Attack each rep!"
            rows={3}
            style={{
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              resize: 'vertical',
              minHeight: 72,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-high)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              fontSize: 'var(--font-size-body-sm)',
              lineHeight: 1.45,
            }}
          />
          <p className="sc-body-sm" style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', textAlign: 'right' }}>
            {coachDraft.length}/{COACH_NOTE_MAX}
          </p>
        </div>
      ) : null}
      {detailOpen && !canEdit && ex.coach_note ? (
        <div style={{ paddingLeft: 52, paddingRight: 6, marginTop: 4 }}>
          <p className="sc-label-caps" style={{ margin: '0 0 4px' }}>
            Exercise instructions
          </p>
          <p className="sc-body-sm" style={{ margin: 0, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
            {String(ex.coach_note)}
          </p>
        </div>
      ) : null}
      {detailOpen && canEdit ? (
        <div
          style={{ paddingLeft: 52, minWidth: 0, maxWidth: '100%' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <PrescriptionPillRow exercise={ex} orgId={orgId} canEdit={canEdit} onReload={onReload} />
        </div>
      ) : null}
    </div>
  )
}
