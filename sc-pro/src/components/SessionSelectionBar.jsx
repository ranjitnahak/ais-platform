import { btnOutline } from '../lib/programmeSessionUi.js'

const barBtn = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-body-sm)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
}

export default function SessionSelectionBar({
  count,
  busy,
  deleteConfirm,
  onPublishAll,
  onCopy,
  onDelete,
  onDismiss,
  onCancelDelete,
  onConfirmDelete,
}) {
  return (
    <div
      data-session-selection-bar
      style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--sidebar-width)',
        right: 0,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--color-surface-highest)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 100,
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 'var(--font-size-body)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text)',
        }}
      >
        {count} session{count === 1 ? '' : 's'} selected
      </span>
      {deleteConfirm ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="sc-body-sm" style={{ color: 'var(--color-text)' }}>
            Delete {count} session{count === 1 ? '' : 's'}?
          </span>
          <button type="button" disabled={busy} style={{ ...btnOutline, ...barBtn }} onClick={onCancelDelete}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            style={{
              ...barBtn,
              border: 'none',
              background: 'var(--color-danger)',
              color: 'var(--color-bg)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
            onClick={onConfirmDelete}
          >
            Confirm
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" disabled={busy} style={{ ...btnOutline, ...barBtn }} onClick={onPublishAll}>
            Publish All
          </button>
          <button type="button" disabled={busy} style={{ ...btnOutline, ...barBtn }} onClick={onCopy}>
            Copy
          </button>
          <button
            type="button"
            disabled={busy}
            style={{
              ...btnOutline,
              ...barBtn,
              color: 'var(--color-danger)',
              borderColor: 'var(--color-danger)',
            }}
            onClick={onDelete}
          >
            Delete
          </button>
          <button
            type="button"
            aria-label="Dismiss selection"
            disabled={busy}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            onClick={onDismiss}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
