import { DOMAIN_LABELS, formatNoteDate } from '../../lib/staffLogsConstants';

function TeamNoteBlock({ note }) {
  const authorName = note.users?.full_name ?? 'Staff';
  const domainLabel = DOMAIN_LABELS[note.domain] ?? note.domain ?? 'General';
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
        {authorName} · {domainLabel} · {formatNoteDate(note.observation_date)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--color-on-surface-variant)]">
        {note.note_text}
      </p>
    </div>
  );
}

export default function StaffLogsTeamSection({ teamNotes }) {
  return (
    <section className="border-t border-[var(--color-outline-variant)] p-5">
      <h2 className="text-xl font-black text-[var(--color-on-surface)]">Team Notes</h2>
      <div className="mt-4 min-h-[1rem]">
        {(teamNotes ?? []).map((note) => (
          <TeamNoteBlock key={note.id} note={note} />
        ))}
      </div>
    </section>
  );
}
