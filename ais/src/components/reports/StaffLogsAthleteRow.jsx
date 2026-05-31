import { athleteDisplayName } from '../../lib/athleteName';
import { DOMAIN_LABELS, formatNoteDate, getAge, initials } from '../../lib/staffLogsConstants';

function NoteBlock({ note }) {
  const authorName = note.users?.full_name ?? 'Staff';
  const domainLabel = DOMAIN_LABELS[note.domain] ?? note.domain ?? 'General';
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
        {authorName} · {domainLabel} · {formatNoteDate(note.observation_date)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-7 text-[var(--color-on-surface-variant)]">
        {note.note_text}
      </p>
    </div>
  );
}

export default function StaffLogsAthleteRow({ athlete, notes }) {
  const age = getAge(athlete?.date_of_birth);
  const displayName = athleteDisplayName(athlete) || athlete?.full_name || 'Athlete';

  return (
    <article className="flex gap-4 border-b border-[var(--color-outline-variant)] p-4 last:border-b-0">
      <aside className="w-[140px] shrink-0 text-center">
        {athlete?.photo_url ? (
          <img
            src={athlete.photo_url}
            alt={displayName}
            className="mx-auto h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-base font-black text-[var(--color-primary)]"
            style={{ background: 'var(--color-surface-variant)' }}
          >
            {initials(displayName)}
          </div>
        )}
        <h3 className="mt-3 text-[13px] font-black leading-tight text-[var(--color-on-surface)]">
          {displayName}
        </h3>
        <p className="mt-1 text-[11px] text-[var(--color-on-surface-variant)]">
          {athlete?.position ?? 'Position not set'}
        </p>
        <p className="text-[11px] text-[var(--color-on-surface-variant)]">
          {[athlete?.gender, age ? `Age ${age}` : null].filter(Boolean).join(' · ')}
        </p>
      </aside>
      <div className="min-h-[5rem] flex-1 pl-4">
        {(notes ?? []).map((note) => (
          <NoteBlock key={note.id} note={note} />
        ))}
      </div>
    </article>
  );
}
