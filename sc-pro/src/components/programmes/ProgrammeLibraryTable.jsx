import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DIFF_BADGE,
  PHASE_ACCENT_VAR,
  PHASE_BADGE,
  formatRelativeActivity,
} from '../../lib/programmeUi.js'
import { IconButton, MenuItem, badgeBase } from './programmeLibraryUi.jsx'
import { PAGE_SIZE } from '../../hooks/useProgrammesLibrary.js'

/** Fixed panel aligned to overflow menu trigger; scrollable if viewport is short */
function programmeMenuStyle(rect) {
  if (!rect || typeof window === 'undefined') return {}
  const w = 220
  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = rect.right - w
  left = Math.max(pad, Math.min(left, vw - w - pad))
  let top = rect.bottom + 6
  const maxFixed = 280
  let maxHeight = Math.min(maxFixed, vh - top - pad)
  if (maxHeight < 112) {
    const above = rect.top - pad
    const useAbove = Math.min(maxFixed, above - 6)
    if (useAbove > maxHeight + 20) {
      maxHeight = useAbove
      top = Math.max(pad, rect.top - maxHeight - 6)
    } else {
      maxHeight = Math.max(112, Math.min(maxFixed, vh - top - pad))
    }
  }
  return {
    position: 'fixed',
    left,
    top,
    width: w,
    maxHeight,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    zIndex: 10000,
    background: 'var(--color-surface-highest)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
  }
}

export default function ProgrammeLibraryTable({
  slice,
  filteredLength,
  pageSafe,
  totalPages,
  teamUsage,
  navigate,
  duplicateProgramme,
  deleteProgramme,
  saveAsTemplate,
  setPage,
}) {
  const [menu, setMenu] = useState(null)
  const menuPanelRef = useRef(null)

  const menuStyle = useMemo(() => programmeMenuStyle(menu?.rect), [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const onDown = (e) => {
      if (menuPanelRef.current?.contains(e.target)) return
      if (e.target.closest?.('[data-programme-menu-trigger="true"]')) return
      setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [menu])

  const openMenuForRow = (r, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu((prev) => (prev?.programme?.id === r.id ? null : { programme: r, rect }))
  }

  const menuPortal =
    menu &&
    createPortal(
      <div ref={menuPanelRef} data-programme-menu="panel" role="menu" style={menuStyle}>
        <MenuItem
          onClick={() => {
            setMenu(null)
            navigate(`/programmes/${menu.programme.id}/edit`)
          }}
        >
          Edit programme overview
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null)
            saveAsTemplate(menu.programme)
          }}
        >
          Save as Template
        </MenuItem>
        <MenuItem onClick={() => setMenu(null)}>Archive</MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null)
            deleteProgramme(menu.programme.id)
          }}
        >
          Delete
        </MenuItem>
      </div>,
      document.body,
    )

  return (
    <>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)' }}>
              {['Programme name', 'Sport', 'Phase', 'Training age', 'Difficulty', 'Team usage', 'Last activity', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="sc-label-caps"
                    style={{
                      textAlign: h === 'Actions' ? 'right' : 'left',
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const phaseKey = PHASE_BADGE[r.phase_type] ? r.phase_type : 'general'
              const diffKey = DIFF_BADGE[r.difficulty] ? r.difficulty : 'moderate'
              const accent = PHASE_ACCENT_VAR[phaseKey] || PHASE_ACCENT_VAR.general
              const menuOpen = menu?.programme?.id === r.id
              return (
                <tr key={r.id} className="sc-table-row">
                  <td style={{ padding: '12px', borderLeft: `3px solid var(${accent})` }}>
                    <strong>{r.name}</strong>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {r.sport ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-surface-high)',
                          color: 'var(--color-text-muted)',
                          fontSize: 'var(--font-size-body-sm)',
                        }}
                      >
                        {r.sport}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ ...badgeBase, ...PHASE_BADGE[phaseKey] }}>{phaseKey}</span>
                  </td>
                  <td style={{ padding: '12px' }}>{r.training_age ?? '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ ...badgeBase, ...DIFF_BADGE[diffKey] }}>{diffKey.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '12px' }}>{teamUsage[r.id] ?? 0} teams</td>
                  <td style={{ padding: '12px' }}>
                    <div>{formatRelativeActivity(r.updated_at || r.created_at)}</div>
                    <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                      by coach
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', verticalAlign: 'middle' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', opacity: menuOpen ? 1 : 0.92 }}>
                      <IconButton label="Copy" onClick={() => duplicateProgramme(r)} icon="copy" />
                      <IconButton label="More" onClick={(e) => openMenuForRow(r, e)} icon="dots" menuTrigger />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {menuPortal}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-body-sm)',
        }}
      >
        <span>
          Showing {(pageSafe - 1) * PAGE_SIZE + 1}-{Math.min(pageSafe * PAGE_SIZE, filteredLength)} of {filteredLength}{' '}
          programmes
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                background: n === pageSafe ? 'var(--color-primary)' : 'var(--color-surface-high)',
                color: n === pageSafe ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
