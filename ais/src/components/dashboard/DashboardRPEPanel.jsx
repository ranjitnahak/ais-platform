import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser, canSync } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import SessionRPEView from '../sessions/SessionRPEView';
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton';

export default function DashboardRPEPanel() {
  const { user } = useUser();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canView = canSync(user, 'rpe_logging', 'view');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    async function loadSessions() {
      try {
        setLoading(true);
        setError(null);
        const currentUser = await getCurrentUser();
        if (!currentUser?.teamIds?.length) {
          if (mounted) setSessions([]);
          return;
        }
        const today = new Date().toISOString().split('T')[0];
        const { data, error: sessionError } = await supabase
          .from('sessions')
          .select('id, name, planned_rpe, category')
          .eq('org_id', currentUser.orgId)
          .in('team_id', currentUser.teamIds)
          .eq('session_date', today)
          .order('name');
        if (sessionError) throw sessionError;
        if (!mounted) return;
        setSessions(data ?? []);
        if (data?.[0]?.id) setSelectedSessionId(data[0].id);
      } catch (err) {
        console.error('[DashboardRPEPanel] loadSessions failed:', err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadSessions();
    return () => {
      mounted = false;
    };
  }, [canView]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);

  if (!canView) {
    return (
      <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 text-sm font-bold text-[var(--color-on-surface-variant)]">
        You do not have permission to view session RPE logs.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {loading && <DashboardSkeleton contentOnly />}

      {error && (
        <p className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {!loading && !error && !sessions.length && (
        <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 text-sm font-bold text-[var(--color-on-surface-variant)]">
          No sessions scheduled for today.
        </p>
      )}

      {!loading && sessions.length > 0 && (
        <>
          <label className="block max-w-md">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
              Session
            </span>
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 text-sm font-bold outline-none"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </label>
          {selectedSession && (
            <SessionRPEView
              sessionId={selectedSession.id}
              sessionName={selectedSession.name}
              plannedRpe={selectedSession.planned_rpe}
            />
          )}
        </>
      )}
    </div>
  );
}
