import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export default function AthleteProfileSelf() {
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const user = await getCurrentUser();
        if (!user?.orgId) throw new Error('No authenticated user found.');
        if (!user.athleteId) throw new Error('No athlete profile linked to this account.');

        const { data, error: athleteError } = await supabase
          .from('athletes')
          .select('id, full_name, first_name, last_name, email, phone, date_of_birth, gender, position, jersey_number, photo_url')
          .eq('org_id', user.orgId)
          .eq('id', user.athleteId)
          .single();
        if (athleteError) throw athleteError;
        if (mounted) setAthlete(data);
      } catch (err) {
        console.error('[AthleteProfileSelf] load', err);
        if (mounted) setError(err.message || 'Could not load profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <p className="text-sm text-[var(--color-outline)]">Loading profile…</p>;
  if (error) return <p className="text-sm text-[var(--color-error)]">{error}</p>;
  if (!athlete) return <p className="text-sm text-[var(--color-outline)]">No profile found.</p>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Athlete</p>
      <h1 className="mt-2 text-xl font-black text-[var(--color-on-surface)]">My Profile</h1>

      <div className="mt-5 flex items-center gap-4">
        {athlete.photo_url ? (
          <img
            src={athlete.photo_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover border border-[var(--color-outline-variant)]"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-variant)] text-lg font-black">
            {(athlete.full_name || athlete.email || '?').charAt(0)}
          </div>
        )}
        <div>
          <p className="text-lg font-black">{athlete.full_name || [athlete.first_name, athlete.last_name].filter(Boolean).join(' ')}</p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">{athlete.email || '—'}</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 text-sm">
        <Row label="Phone" value={athlete.phone || '—'} />
        <Row label="DOB" value={athlete.date_of_birth || '—'} />
        <Row label="Gender" value={athlete.gender || '—'} />
        <Row label="Position" value={athlete.position || '—'} />
        <Row label="Jersey" value={athlete.jersey_number ?? '—'} />
      </dl>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-4 py-3">
      <dt className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{label}</dt>
      <dd className="text-[var(--color-on-surface)]">{value}</dd>
    </div>
  );
}

