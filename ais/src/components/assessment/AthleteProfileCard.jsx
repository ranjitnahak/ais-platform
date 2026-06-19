import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import { toTitleCase } from '../../lib/formatters';

function computeAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export default function AthleteProfileCard({ athlete, teamName, testingDatesCount }) {
  if (!athlete) return null;

  const age = computeAge(athlete.date_of_birth);
  const name = athleteDisplayName(athlete);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      {athlete.photo_url ? (
        <img
          src={athlete.photo_url}
          alt=""
          className="h-16 w-16 shrink-0 rounded-full border border-[var(--color-outline-variant)] object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] text-lg font-black text-[var(--color-on-surface)]">
          {athleteInitialsFromAthlete(athlete)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-black tracking-tight text-[var(--color-on-surface)]">
          {name}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-on-surface-variant)]">
          {[athlete.position ? toTitleCase(athlete.position) : null, age != null ? `Age ${age}` : null, teamName].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="shrink-0 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Testing dates
        </p>
        <p className="text-xl font-black text-[var(--color-on-surface)]">{testingDatesCount}</p>
      </div>
    </div>
  );
}
