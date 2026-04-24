import { PHASE_TYPES, TRAINING_AGES } from '../lib/programmeUi.js'
import { useProgrammesLibrary } from '../hooks/useProgrammesLibrary.js'
import ProgrammeLibraryTable from '../components/programmes/ProgrammeLibraryTable.jsx'
import CreateProgrammeModal from '../components/programmes/CreateProgrammeModal.jsx'
import { FilterSelect, btnOutline, btnPrimary } from '../components/programmes/programmeLibraryUi.jsx'

export default function Programmes() {
  const v = useProgrammesLibrary()

  return (
    <div style={{ padding: 'var(--space-container)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 className="sc-headline" style={{ margin: 0, flex: '1 1 200px' }}>
          Programme Library
        </h1>
        <input
          type="search"
          placeholder="Search programmes…"
          value={v.search}
          onChange={(e) => {
            v.setSearch(e.target.value)
            v.setPage(1)
          }}
          style={{
            flex: '1 1 220px',
            maxWidth: 360,
            padding: '10px 12px',
            borderRadius: 'var(--radius-default)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-primary)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--color-border)'
          }}
        />
        <button
          type="button"
          style={{
            ...btnOutline,
            borderColor: v.onlyTemplates ? 'var(--color-primary)' : 'var(--color-border)',
            color: v.onlyTemplates ? 'var(--color-primary)' : 'var(--color-text)',
          }}
          onClick={() => {
            v.setOnlyTemplates((t) => !t)
            v.setPage(1)
          }}
        >
          Templates ({v.templateCount})
        </button>
        <button type="button" style={btnPrimary} onClick={() => v.setModal({})}>
          + Create Programme
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <FilterSelect label="Sport" value={v.sport} options={v.sportOptions} onChange={v.setSport} resetPage={() => v.setPage(1)} />
        <FilterSelect label="Phase type" value={v.phase} options={['All', ...PHASE_TYPES]} onChange={v.setPhase} resetPage={() => v.setPage(1)} />
        <FilterSelect label="Training age" value={v.age} options={['All', ...TRAINING_AGES]} onChange={v.setAge} resetPage={() => v.setPage(1)} />
        <FilterSelect label="Created by" value={v.createdBy} options={['Any Coach']} onChange={v.setCreatedBy} resetPage={() => v.setPage(1)} />
      </div>

      {v.error && (
        <p style={{ color: 'var(--color-danger)', marginBottom: 12 }} role="alert">
          {v.error}
        </p>
      )}

      {v.loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Loading programmes…</div>
      ) : v.filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>No programmes yet. Create your first programme.</p>
          <button type="button" style={{ ...btnPrimary, marginTop: 16 }} onClick={() => v.setModal({})}>
            + Create Programme
          </button>
        </div>
      ) : (
        <ProgrammeLibraryTable
          slice={v.slice}
          filteredLength={v.filtered.length}
          pageSafe={v.pageSafe}
          totalPages={v.totalPages}
          teamUsage={v.teamUsage}
          menuRow={v.menuRow}
          setMenuRow={v.setMenuRow}
          navigate={v.navigate}
          duplicateProgramme={v.duplicateProgramme}
          deleteProgramme={v.deleteProgramme}
          saveAsTemplate={v.saveAsTemplate}
          setPage={v.setPage}
        />
      )}

      {v.modal && <CreateProgrammeModal onClose={() => v.setModal(null)} onSave={v.handleCreate} />}
    </div>
  )
}
