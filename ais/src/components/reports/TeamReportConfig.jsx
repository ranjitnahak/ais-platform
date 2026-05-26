import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { canSync, useCurrentUser } from '../../lib/auth'
import { useTeamReport } from '../../hooks/useTeamReport'

const LABELS = {
  assessments: 'Assessment Data',
  wellness: 'Wellness & Readiness',
  rpe_logging: 'RPE & Training Load',
  sc_pro: 'Programme & Strength Data',
  injury_surveillance: 'Injury Records',
  athlete_portal: null,
  unified_reports: null,
  periodisation: null,
  ai_assistant: null,
}

function isoDate(daysAgo = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

export default function TeamReportConfig({ teamId, teamName, onReportGenerated }) {
  const { user, loading: userLoading } = useCurrentUser()
  const { generating, error, generateTeamReport } = useTeamReport()
  const [from, setFrom] = useState(isoDate(30))
  const [to, setTo] = useState(isoDate())
  const [sources, setSources] = useState([])
  const [enabledSources, setEnabledSources] = useState([])
  const [loading, setLoading] = useState(true)
  const canCreate = canSync(user, 'unified_reports', 'create')

  useEffect(() => {
    if (!user) return
    async function loadSources() {
      try {
        setLoading(true)
        const { data, error: flagsError } = await supabase
          .from('org_feature_flags')
          .select('feature_key, is_enabled')
          .eq('org_id', user.orgId)
          .eq('is_enabled', true)
        if (flagsError) throw flagsError
        const rows = (data ?? []).filter((row) => LABELS[row.feature_key])
        setSources(rows)
        setEnabledSources(rows.map((row) => row.feature_key))
      } catch (err) {
        console.error('[TeamReportConfig] loadSources failed:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSources()
  }, [user])

  function toggleSource(key) {
    setEnabledSources((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ))
  }

  async function handleGenerate() {
    try {
      const id = await generateTeamReport({ teamId, dateRangeStart: from, dateRangeEnd: to, enabledSources })
      onReportGenerated(id)
    } catch (err) {
      console.error('[TeamReportConfig] generate failed:', err)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-8 text-center">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-5 md:p-6 space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Team Intelligence</p>
        <h2 className="text-2xl font-black tracking-tight text-[var(--color-on-surface)]">Generate Team Report — {teamName}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full rounded-xl bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)] px-4 py-3 text-[var(--color-on-surface)]" />
        </label>
        <label className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full rounded-xl bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)] px-4 py-3 text-[var(--color-on-surface)]" />
        </label>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-black text-[var(--color-on-surface)]">Data Sources</h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]">Select which data to include in the report</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)] px-4 py-3">
            <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-[var(--color-primary-container)] opacity-70" />
            <span>
              <span className="block text-sm font-bold text-[var(--color-on-surface)]">Staff Notes & Observations</span>
              <span className="block text-xs text-[var(--color-on-surface-variant)]">Always included when available</span>
            </span>
          </label>
          {sources.map((source) => (
            <label key={source.feature_key} className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)] px-4 py-3">
              <input type="checkbox" checked={enabledSources.includes(source.feature_key)} onChange={() => toggleSource(source.feature_key)} className="h-4 w-4 accent-[var(--color-primary-container)]" />
              <span className="text-sm font-bold text-[var(--color-on-surface)]">{LABELS[source.feature_key]}</span>
            </label>
          ))}
        </div>
        {sources.length === 0 && (
          <p className="rounded-xl bg-[var(--color-surface-container-high)] p-4 text-sm text-[var(--color-on-surface-variant)]">No report data sources are enabled for this organisation.</p>
        )}
      </section>

      {!canCreate && <p className="text-sm text-[var(--color-error)]">You do not have permission to generate team reports.</p>}
      {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={!canCreate || generating || enabledSources.length === 0}
        className="w-full rounded-xl bg-[var(--color-primary-container)] px-5 py-3 text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {generating && <span className="h-4 w-4 rounded-full border-2 border-[var(--color-on-primary)] border-t-transparent animate-spin" />}
        {generating ? 'Generating... (this may take 30 seconds)' : 'Generate Team Report'}
      </button>
    </div>
  )
}
