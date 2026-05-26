import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { canSync, useCurrentUser } from '../../lib/auth'

function athleteName(row) {
  const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes
  return athlete?.full_name || 'Unknown athlete'
}

function athletePhoto(row) {
  const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes
  return athlete?.photo_url
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function deviationClass(value) {
  if (value == null) return 'text-[var(--color-outline)]'
  const abs = Math.abs(value)
  if (abs <= 1) return 'text-[var(--color-tertiary-container)]'
  if (abs <= 2) return 'text-[var(--color-primary-container)]'
  return 'text-[var(--color-error)]'
}

export default function SessionRPEView({ sessionId, sessionName, plannedRpe }) {
  const { user, loading: userLoading } = useCurrentUser()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const canView = canSync(user, 'rpe_logging', 'view')

  useEffect(() => {
    if (!user?.orgId || !sessionId || !canView) return
    let mounted = true
    async function loadLogs() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: logError } = await supabase
          .from('session_athlete_logs')
          .select('athlete_id, actual_rpe, actual_duration_min, session_load, logged_at, athletes(full_name, photo_url)')
          .eq('session_id', sessionId)
          .eq('org_id', user.orgId)
          .order('logged_at', { ascending: false })
        if (logError) throw logError
        if (mounted) setLogs(data ?? [])
      } catch (err) {
        console.error('[SessionRPEView] loadLogs failed:', err)
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void loadLogs()
    return () => { mounted = false }
  }, [canView, sessionId, user?.orgId])

  const summary = useMemo(() => {
    const logged = logs.filter((log) => log.actual_rpe != null)
    const totalRpe = logged.reduce((sum, log) => sum + Number(log.actual_rpe || 0), 0)
    const avgRpe = logged.length ? totalRpe / logged.length : null
    const deviations = logged
      .map((log) => (plannedRpe == null ? null : Number(log.actual_rpe) - Number(plannedRpe)))
      .filter((value) => value != null)
    const avgDeviation = deviations.length ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length : null
    return { loggedCount: logged.length, totalCount: logs.length, avgRpe, avgDeviation }
  }, [logs, plannedRpe])

  if (userLoading) return null
  if (!canView) return null

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] font-['Inter'] text-[var(--color-on-surface)]">
      <div className="border-b border-[var(--color-outline-variant)] p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">Session RPE</p>
        <h2 className="mt-1 text-xl font-black">{sessionName}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[var(--color-surface)] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Logged</p>
            <p className="mt-1 text-2xl font-black">{summary.loggedCount} of {summary.totalCount}</p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface)] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Avg Actual RPE</p>
            <p className="mt-1 text-2xl font-black">{summary.avgRpe == null ? '—' : summary.avgRpe.toFixed(1)}</p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface)] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Avg Deviation</p>
            <p className={`mt-1 text-2xl font-black ${deviationClass(summary.avgDeviation)}`}>
              {summary.avgDeviation == null ? '—' : summary.avgDeviation.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {error && <p className="p-5 text-sm text-[var(--color-error)]">{error}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading RPE logs...</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                {['Athlete', 'Planned RPE', 'Actual RPE', 'Deviation', 'Session Load', 'Logged At'].map((header) => (
                  <th key={header} className="px-5 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {logs.map((log) => {
                const actual = log.actual_rpe == null ? null : Number(log.actual_rpe)
                const deviation = actual == null || plannedRpe == null ? null : actual - Number(plannedRpe)
                const load = log.session_load ?? (actual != null && log.actual_duration_min ? actual * Number(log.actual_duration_min) : null)
                return (
                  <tr key={log.athlete_id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {athletePhoto(log) ? (
                          <img src={athletePhoto(log)} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-[var(--color-surface-variant)]" />
                        )}
                        <span className="font-bold text-[var(--color-on-surface)]">{athleteName(log)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{plannedRpe ?? '—'}</td>
                    <td className="px-5 py-4 text-[var(--color-on-surface)]">{actual ?? '—'}</td>
                    <td className={`px-5 py-4 font-black ${deviationClass(deviation)}`}>{deviation == null ? '—' : deviation.toFixed(1)}</td>
                    <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{load == null ? '—' : `${Math.round(load)} AU`}</td>
                    <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{formatTime(log.logged_at)}</td>
                  </tr>
                )
              })}
              {!logs.length && (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-[var(--color-outline)]">No RPE logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
