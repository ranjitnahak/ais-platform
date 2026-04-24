import {
  DIFF_BADGE,
  PHASE_ACCENT_VAR,
  PHASE_BADGE,
  formatRelativeActivity,
} from '../../lib/programmeUi.js'
import { IconButton, MenuItem, badgeBase } from './programmeLibraryUi.jsx'
import { PAGE_SIZE } from '../../hooks/useProgrammesLibrary.js'

export default function ProgrammeLibraryTable({
  slice,
  filteredLength,
  pageSafe,
  totalPages,
  teamUsage,
  menuRow,
  setMenuRow,
  navigate,
  duplicateProgramme,
  deleteProgramme,
  saveAsTemplate,
  setPage,
}) {
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
              return (
                <tr
                  key={r.id}
                  className="sc-table-row"
                  style={{ position: 'relative' }}
                  onMouseLeave={() => setMenuRow((m) => (m === r.id ? null : m))}
                >
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
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <span style={{ opacity: menuRow === r.id ? 1 : 0.35 }} className="row-actions">
                      <IconButton label="Edit" onClick={() => navigate(`/programmes/${r.id}/edit`)} icon="pencil" />
                      <IconButton label="Copy" onClick={() => duplicateProgramme(r)} icon="copy" />
                      <IconButton label="More" onClick={() => setMenuRow(r.id)} icon="dots" />
                    </span>
                    {menuRow === r.id && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: 44,
                          background: 'var(--color-surface-highest)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          zIndex: 5,
                          minWidth: 180,
                        }}
                      >
                        <MenuItem onClick={() => saveAsTemplate(r)}>Save as Template</MenuItem>
                        <MenuItem
                          onClick={() => {
                            setMenuRow(null)
                          }}
                        >
                          Archive
                        </MenuItem>
                        <MenuItem onClick={() => deleteProgramme(r.id)}>Delete</MenuItem>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
