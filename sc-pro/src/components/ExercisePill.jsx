import { useEffect, useRef, useState } from 'react'
import { PILL_VARIANT, pillEditKind, pillInputSuffix } from '../lib/prescriptionPillLogic.js'

const basePill = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--font-size-body-sm)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-high)',
  color: 'var(--color-text)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: '100%',
  minHeight: 34,
}

function variantStyles(variant) {
  if (variant === PILL_VARIANT.intensity) {
    return {
      background: 'var(--color-prescription-intensity-bg)',
      border: '1px solid var(--color-prescription-intensity-border)',
      color: 'var(--color-prescription-intensity)',
    }
  }
  if (variant === PILL_VARIANT.effort) {
    return {
      background: 'var(--color-prescription-effort-bg)',
      border: '1px solid var(--color-prescription-effort-border)',
      color: 'var(--color-prescription-effort)',
    }
  }
  if (variant === PILL_VARIANT.time) {
    return {
      background: 'var(--color-prescription-time-bg)',
      border: '1px solid var(--color-prescription-time-border)',
      color: 'var(--color-prescription-time)',
    }
  }
  if (variant === PILL_VARIANT.detail) {
    return {
      background: 'var(--color-prescription-detail-bg)',
      border: '1px solid var(--color-prescription-detail-border)',
      color: 'var(--color-text-muted)',
    }
  }
  return {}
}

export default function ExercisePill({ pillKey, label, variant, removable, editing, onBeginEdit, onSave, onCancel, onRemove }) {
  const [local, setLocal] = useState('')
  const [hover, setHover] = useState(false)
  const inputRef = useRef(null)
  const kind = pillEditKind(pillKey)
  const suffix = pillInputSuffix(pillKey)
  const vStyle = variantStyles(variant)
  const merged = { ...basePill, ...vStyle }

  useEffect(() => {
    if (!editing) return
    const m = String(label).match(/-?[\d.]+/)
    setLocal(m ? m[0] : '')
    requestAnimationFrame(() => {
      inputRef.current?.focus?.()
      inputRef.current?.select?.()
    })
  }, [editing, label, pillKey])

  if (editing) {
    const w = pillKey === 'rpe' ? 52 : pillKey === 'velocity' ? 56 : 58
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          ref={inputRef}
          type={kind === 'number' ? 'number' : 'text'}
          value={local}
          min={pillKey === 'rpe' || pillKey === 'tertiary_rpe' ? 1 : undefined}
          max={pillKey === 'rpe' || pillKey === 'tertiary_rpe' ? 10 : undefined}
          step={
            pillKey === 'velocity' || pillKey === 'tertiary_velocity'
              ? 0.01
              : pillKey === 'weight' ||
                  pillKey === 'pct1rm' ||
                  pillKey === 'secondary_weight' ||
                  pillKey === 'secondary_pct1rm' ||
                  pillKey === 'tertiary_weight' ||
                  pillKey === 'tertiary_pct1rm'
                ? 0.5
                : 1
          }
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSave?.(local)
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel?.()
            }
          }}
          onBlur={() => void onSave?.(local)}
          style={{
            width: w,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-body-sm)',
          }}
        />
        {suffix ? (
          <span className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {suffix}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <button
      type="button"
      style={{
        ...merged,
        borderColor: hover ? 'var(--color-primary)' : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onBeginEdit?.()}
    >
      <span>{label}</span>
      {removable && hover ? (
        <span
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            void onRemove?.()
          }}
          style={{ fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}
          title="Remove"
        >
          ×
        </span>
      ) : null}
    </button>
  )
}
