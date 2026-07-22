import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { canSync, getCurrentUser } from '../lib/auth'
import { useUser } from '../context/UserContext'
import { getEffectiveOrgId } from '../lib/orgScope'
import { getStaffDomain, useStaffNotes } from '../hooks/useStaffNotes'
import { useIsMobile } from '../hooks/useIsMobile'
import AthleteNoteRow from '../components/staffnotes/AthleteNoteRow'
import Sidebar from '../components/Sidebar'
import LogSkeleton from '../components/shared/skeletons/LogSkeleton'

const DOMAINS = ['s_and_c', 'physio', 'nutrition', 'psychology', 'analysis', 'coaching']
const STAFF_ROLES = ['admin', 'superuser', 'manager', 'head coach', 's&c coach', 'physio', 'analyst', 'nutritionist']
const DOMAIN_VARS = {
  s_and_c: 'var(--color-primary)',
  physio: 'var(--color-secondary)',
  nutrition: 'var(--color-tertiary)',
  psychology: 'var(--color-secondary-fixed)',
  analysis: 'var(--color-outline)',
  coaching: 'var(--color-primary-fixed)',
}

export default function StaffNotes({ embedded = false }) {
  const { user, loading: userLoading, activeOrgId, activeTeamId } = useUser()
  const [athletes, setAthletes] = useState([])
  const [counts, setCounts] = useState({})
  const selectedTeamId = activeTeamId ?? ''
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [tab, setTab] = useState('team')
  const [loadError, setLoadError] = useState(null)
  const isMobile = useIsMobile()
  const isSuperuser = user?.isSuperuser === true
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId)
  const canView = canSync(user, 'staff_notes', 'view')
  const canCreate = canSync(user, 'staff_notes', 'create')
  const teamNotes = useStaffNotes({ teamId: selectedTeamId, activeOrgId: effectiveOrgId })
  const athleteNotes = useStaffNotes({ teamId: selectedTeamId, athleteId: selectedAthleteId, activeOrgId: effectiveOrgId })
  const userDomain = user ? getStaffDomain(user.role) : null
  const selectedAthlete = athletes.find((athlete) => athlete.id === selectedAthleteId)

  useEffect(() => {
    setSelectedAthleteId('')
  }, [activeTeamId])

  useEffect(() => {
    if (!canView || !selectedTeamId) return
    async function loadAthletes() {
      try {
        setLoadError(null)
        if (!user || !selectedTeamId) return
        const isSuperuser = user.isSuperuser === true
        const effectiveOrgId = (isSuperuser && activeOrgId) ? activeOrgId : user.orgId
        const { data: athleteRows, error: athleteError } = await supabase
          .from('athletes')
          .select('id, full_name, photo_url, athlete_teams!inner(team_id)')
          .eq('org_id', effectiveOrgId) // SUPERUSER: uses activeOrgId
          .eq('athlete_teams.team_id', selectedTeamId)
          .order('full_name', { ascending: true })
        if (athleteError) throw athleteError
        const domain = getStaffDomain(user.role)
        let countQuery = supabase
          .from('athlete_staff_notes')
          .select('athlete_id')
          .eq('org_id', effectiveOrgId) // SUPERUSER: uses activeOrgId
          .eq('team_id', selectedTeamId)
          .eq('note_level', 'athlete')
        if (domain) countQuery = countQuery.eq('domain', domain)
        const { data: countRows, error: countError } = await countQuery
        if (countError) throw countError
        setAthletes(athleteRows ?? [])
        setCounts(countRows?.reduce((acc, row) => ({ ...acc, [row.athlete_id]: (acc[row.athlete_id] ?? 0) + 1 }), {}) ?? {})
        if (!isMobile && !selectedAthleteId && athleteRows?.[0]?.id) setSelectedAthleteId(athleteRows[0].id)
      } catch (err) {
        console.error('[StaffNotes] loadAthletes failed:', err)
        setLoadError(err.message)
      }
    }
    loadAthletes()
  }, [canView, selectedTeamId, selectedAthleteId, user?.id, activeOrgId, isMobile])

  function handleMobileAthleteToggle(athleteId) {
    setSelectedAthleteId((current) => (current === athleteId ? '' : athleteId))
  }

  const visible = useMemo(() => STAFF_ROLES.includes(user?.role), [user?.role])
  const accessDenied = <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 font-bold">Access Denied</p>;
  if (userLoading) return embedded ? <LogSkeleton /> : <Shell><LogSkeleton /></Shell>;
  if ((!canView && !user?.isSuperuser) || !visible) return embedded ? accessDenied : <Shell>{accessDenied}</Shell>;

  const notesContent = (
    <>
      {!embedded && (
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Reports</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Staff Notes</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Append-only athlete and team observations.</p>
        </div>
      </header>
      )}

      {(loadError || teamNotes.error || athleteNotes.error) && (
        <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {loadError || teamNotes.error || athleteNotes.error}
        </div>
      )}

      <div className="flex gap-2 rounded-2xl bg-[var(--color-surface-container)] p-2">
        {['team', 'athlete'].map((key) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`min-h-11 flex-1 rounded-xl text-xs font-black uppercase tracking-widest ${tab === key ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]' : 'text-[var(--color-on-surface-variant)]'}`}>
            {key === 'team' ? 'Team Notes' : 'Athlete Notes'}
          </button>
        ))}
      </div>

      {tab === 'team' ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Panel title="Add Team Note">
            {canCreate ? <NoteForm placeholder="Write a team note..." userDomain={userDomain} onSubmit={teamNotes.submitNote} submitting={teamNotes.submitting} /> : <NoCreate />}
          </Panel>
          <Panel title="Team Notes">
            <NoteList notes={teamNotes.notes} loading={teamNotes.loading} />
          </Panel>
        </section>
      ) : isMobile ? (
        <section>
          <Panel title="Athletes">
            <div className="space-y-2">
              {athletes.map((athlete) => (
                <AthleteNoteRow
                  key={athlete.id}
                  athlete={athlete}
                  count={counts[athlete.id] ?? 0}
                  expanded={selectedAthleteId === athlete.id}
                  onToggle={() => handleMobileAthleteToggle(athlete.id)}
                >
                  {selectedAthleteId === athlete.id && canCreate && (
                    <NoteForm
                      placeholder={`Write a note for ${athlete.full_name}...`}
                      userDomain={userDomain}
                      onSubmit={athleteNotes.submitNote}
                      submitting={athleteNotes.submitting}
                    />
                  )}
                  {selectedAthleteId === athlete.id && !canCreate && <NoCreate />}
                  {selectedAthleteId === athlete.id && (
                    <NoteList notes={athleteNotes.notes} loading={athleteNotes.loading} />
                  )}
                </AthleteNoteRow>
              ))}
            </div>
          </Panel>
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Panel title="Athletes">
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {athletes.map((athlete) => (
                <AthleteRow
                  key={athlete.id}
                  athlete={athlete}
                  count={counts[athlete.id] ?? 0}
                  selected={selectedAthleteId === athlete.id}
                  onClick={() => setSelectedAthleteId(athlete.id)}
                />
              ))}
            </div>
          </Panel>
          <Panel title={selectedAthlete ? selectedAthlete.full_name : 'Select Athlete'}>
            {selectedAthleteId && canCreate && (
              <NoteForm
                placeholder="Write an athlete note..."
                userDomain={userDomain}
                onSubmit={athleteNotes.submitNote}
                submitting={athleteNotes.submitting}
              />
            )}
            {selectedAthleteId && !canCreate && <NoCreate />}
            <NoteList notes={athleteNotes.notes} loading={athleteNotes.loading} />
          </Panel>
        </section>
      )}
    </>
  );

  if (embedded) return <div className="space-y-6">{notesContent}</div>;
  return <Shell>{notesContent}</Shell>;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-['Inter'] text-[var(--color-on-surface)]">
      <Sidebar />
      <main className="space-y-6 px-4 py-8 pb-28 pt-20 lg:pb-16 lg:pl-72 md:px-8">{children}</main>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <section className="rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h2 className="mb-4 text-lg font-black tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function NoteForm({ placeholder, userDomain, onSubmit, submitting }) {
  const [note, setNote] = useState('')
  const [domain, setDomain] = useState(DOMAINS[0])
  async function handleSubmit() {
    if (!note.trim()) return
    try {
      await onSubmit({ note: note.trim(), domain: userDomain ?? domain })
      setNote('')
    } catch (err) {
      console.error('[StaffNotes] note submit failed:', err)
    }
  }
  return (
    <div className="space-y-4">
      <textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 text-sm outline-none" />
      {userDomain ? (
        <DomainBadge domain={userDomain} />
      ) : (
        <select value={domain} onChange={(event) => setDomain(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-sm font-bold outline-none">
          {DOMAINS.map((item) => <option key={item} value={item}>{formatDomain(item)}</option>)}
        </select>
      )}
      <button type="button" disabled={submitting || !note.trim()} onClick={handleSubmit} className="min-h-12 w-full rounded-xl bg-[var(--color-primary-container)] text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50">
        {submitting ? 'Adding...' : 'Add Note'}
      </button>
    </div>
  )
}

function AthleteRow({ athlete, count, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left ${selected ? 'border-[var(--color-primary)] bg-[var(--color-surface)]' : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]'}`}>
      {athlete.photo_url ? <img src={athlete.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] font-black">{(athlete.full_name ?? '?').slice(0, 1)}</div>}
      <span className="min-w-0 flex-1 truncate text-sm font-black">{athlete.full_name}</span>
      <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[10px] font-black text-[var(--color-outline)]">{count}</span>
    </button>
  )
}

function NoteList({ notes, loading }) {
  if (loading) return <LogSkeleton contentOnly className="py-4" />
  if (!notes.length) return <p className="rounded-2xl bg-[var(--color-surface)] p-4 text-sm font-bold text-[var(--color-on-surface-variant)]">No notes yet.</p>
  return <div className="space-y-3">{notes.map((note) => <NoteCard key={note.id} note={note} />)}</div>
}

function NoteCard({ note }) {
  return (
    <article className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DomainBadge domain={note.domain} />
        <span className="text-xs font-bold text-[var(--color-on-surface-variant)]">{authorName(note)} · {formatDate(note.created_at)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-on-surface)]">{note.note}</p>
    </article>
  )
}

function DomainBadge({ domain }) {
  const color = DOMAIN_VARS[domain] ?? 'var(--color-outline)'
  return <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color, borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}>{formatDomain(domain)}</span>
}

function NoCreate() {
  return <p className="rounded-2xl bg-[var(--color-surface)] p-4 text-sm font-bold text-[var(--color-on-surface-variant)]">You can view notes but do not have permission to add them.</p>
}

function authorName(note) {
  const users = Array.isArray(note.users) ? note.users[0] : note.users
  return users?.full_name ?? 'Unknown author'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'No date'
}

function formatDomain(domain) {
  return (domain ?? '').replaceAll('_', ' ').toUpperCase()
}
