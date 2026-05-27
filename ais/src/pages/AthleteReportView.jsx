import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { canSync } from '../lib/auth'
import { useUser } from '../context/UserContext'
import { generateAthleteReport } from '../lib/generateAthleteReport'

const DOMAIN_COLORS = {
  s_and_c: 'var(--color-primary)',
  physio: 'var(--color-secondary)',
  nutrition: 'var(--color-tertiary)',
  psychology: 'var(--color-secondary-fixed)',
  analysis: 'var(--color-outline)',
  coaching: 'var(--color-primary-fixed)',
}

const CLASS_COLORS = {
  Excellent: 'var(--color-tertiary)',
  'Above Average': 'var(--color-secondary)',
  Average: 'var(--color-primary)',
  'Below Average': 'var(--color-error)',
}

export default function AthleteReportView() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { user, loading: userLoading } = useUser()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!canSync(user, 'unified_reports', 'view')) {
      setLoading(false)
      return
    }
    async function loadReport() {
      try {
        setLoading(true)
        setError(null)
        const { data, error: reportError } = await supabase
          .from('athlete_reports')
          .select('*, athletes(full_name, photo_url, position, gender)')
          .eq('id', reportId)
          .eq('org_id', user.orgId)
          .single()
        if (reportError) throw reportError
        setReport(data)
      } catch (err) {
        console.error('[AthleteReportView] loadReport failed:', err)
        setError('Report not found')
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [reportId, user, userLoading])

  async function handleRegenerate() {
    try {
      setRegenerating(true)
      setError(null)
      const savedReport = await generateAthleteReport({
        athleteId: report.athlete_id,
        orgId: user.orgId,
        user,
        dateRangeStart: report.date_range_start,
        dateRangeEnd: report.date_range_end,
      })
      const patch = {
        section_assessment: savedReport.section_assessment,
        section_training: savedReport.section_training,
        section_wellness: savedReport.section_wellness,
        section_staff_notes: savedReport.section_staff_notes,
        section_ai_synthesis: savedReport.section_ai_synthesis,
        ai_model_version: savedReport.ai_model_version,
        status: savedReport.status,
      }
      const { data: updatedReport, error: updateError } = await supabase
        .from('athlete_reports')
        .update(patch)
        .eq('id', report.id)
        .eq('org_id', user.orgId)
        .select('*, athletes(full_name, photo_url, position, gender)')
        .single()
      if (updateError) throw updateError
      await supabase.from('athlete_reports').delete().eq('id', savedReport.id).eq('org_id', user.orgId)
      setReport(updatedReport)
      navigate(`/reports/athlete/${report.id}`, { replace: true })
    } catch (err) {
      console.error('[AthleteReportView] regenerate failed:', err)
      setError(err.message)
    } finally {
      setRegenerating(false)
    }
  }

  if (userLoading || loading) return <Shell><Spinner /></Shell>
  if (!canSync(user, 'unified_reports', 'view')) return <Shell><AccessDenied /></Shell>
  if (error || !report) return <Shell><ErrorCard message={error ?? 'Report not found'} /></Shell>

  const athlete = Array.isArray(report.athletes) ? report.athletes[0] : report.athletes

  return (
    <Shell>
      <header className="rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {athlete?.photo_url ? <img src={athlete.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Avatar name={athlete?.full_name} />}
            <div>
              <button type="button" onClick={() => navigate(`/athletes/${report.athlete_id}`)} className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Back to athlete profile</button>
              <h1 className="text-3xl font-black tracking-tight">{athlete?.full_name ?? 'Athlete Report'}</h1>
              <p className="mt-1 text-sm font-bold text-[var(--color-on-surface-variant)]">{[athlete?.position, athlete?.gender].filter(Boolean).join(' | ')}</p>
              <p className="mt-2 text-xs font-bold text-[var(--color-outline)]">Generated on {formatDateTime(report.generated_at ?? report.created_at)} by {report.generated_by ?? 'Staff'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="min-h-11 rounded-xl border border-[var(--color-outline-variant)] px-4 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)]">Export PDF</button>
            <button type="button" onClick={handleRegenerate} disabled={regenerating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary-container)] px-4 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50">
              {regenerating && <span className="material-symbols-outlined animate-spin text-base">refresh</span>}
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        </div>
      </header>

      {error && <ErrorCard message={error} />}
      <AssessmentSection data={report.section_assessment} />
      <TrainingSection data={report.section_training} />
      <WellnessSection data={report.section_wellness} />
      <StaffNotesSection data={report.section_staff_notes} />
      <SynthesisSection data={report.section_ai_synthesis} />
    </Shell>
  )
}

function Shell({ children }) {
  return <main className="min-h-screen space-y-6 bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)] md:px-8">{children}</main>
}

function Section({ title, children, prominent = false }) {
  return (
    <section className={`rounded-3xl border border-[var(--color-outline-variant)] p-6 ${prominent ? 'bg-[var(--color-surface-container-high)]' : 'bg-[var(--color-surface-container)]'}`}>
      <h2 className="mb-4 text-xl font-black tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function AssessmentSection({ data }) {
  if (!data) return null
  return (
    <Section title="Physical Assessment">
      <p className="mb-4 text-sm font-bold text-[var(--color-on-surface-variant)]">{data.sessionName} | {formatDate(data.sessionDate)}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]"><tr><th className="py-3">Test</th><th>Score</th><th>Classification</th><th>Percentile</th></tr></thead>
          <tbody>{data.results.map((result) => <AssessmentRow key={result.test_id} result={result} />)}</tbody>
        </table>
      </div>
    </Section>
  )
}

function AssessmentRow({ result }) {
  const test = Array.isArray(result.test_definitions) ? result.test_definitions[0] : result.test_definitions
  const color = CLASS_COLORS[result.classification] ?? 'var(--color-outline)'
  return (
    <tr className="border-t border-[var(--color-outline-variant)]">
      <td className="py-3 font-bold">{test?.name ?? result.test_id}</td>
      <td>{result.value} {test?.unit ?? ''}</td>
      <td><span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}>{result.classification ?? 'Unclassified'}</span></td>
      <td>{result.percentile_rank ? `${result.percentile_rank}th` : '-'}</td>
    </tr>
  )
}

function TrainingSection({ data }) {
  if (!data) return null
  return <Section title="Training Load"><StatGrid stats={[['Total Sessions', data.totalSessions], ['Average RPE', `${data.averageActualRpe}/10`], ['Total Load (AU)', data.totalLoad]]} /></Section>
}

function WellnessSection({ data }) {
  if (!data) return null
  return (
    <Section title="Wellness & Readiness">
      <StatGrid stats={[['Days Logged', data.totalDays], ['Average Score', `${data.averageScore}/5`], ['Flagged Days', data.flagCount], ['Trend', <TrendBadge key="trend" trend={data.trend} />]]} />
    </Section>
  )
}

function StaffNotesSection({ data }) {
  if (!data) return null
  return (
    <Section title="Staff Observations">
      <div className="space-y-5">{Object.entries(data).map(([domain, notes]) => <DomainNotes key={domain} domain={domain} notes={notes} />)}</div>
    </Section>
  )
}

function DomainNotes({ domain, notes }) {
  return (
    <div>
      <DomainBadge domain={domain} />
      <div className="mt-3 space-y-2">{notes.map((note, index) => <p key={`${domain}-${index}`} className="rounded-2xl bg-[var(--color-surface)] p-4 text-sm leading-6"><span className="font-black text-[var(--color-outline)]">[{formatDate(note.date)}] {note.author}: </span>{note.note}</p>)}</div>
    </div>
  )
}

function SynthesisSection({ data }) {
  if (!data?.text) return null
  return (
    <Section title="Consolidated Report" prominent>
      <div className="space-y-4 rounded-2xl bg-[var(--color-surface-bright)] p-5 text-base leading-7">{data.text.split('\n').filter(Boolean).map((text, index) => <p key={index}>{text}</p>)}</div>
    </Section>
  )
}

function StatGrid({ stats }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-2xl bg-[var(--color-surface)] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
}

function TrendBadge({ trend }) {
  const color = trend === 'improving' ? 'var(--color-tertiary)' : trend === 'declining' ? 'var(--color-error)' : 'var(--color-outline)'
  return <span className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}>{String(trend).replaceAll('_', ' ')}</span>
}

function DomainBadge({ domain }) {
  const color = DOMAIN_COLORS[domain] ?? 'var(--color-outline)'
  return <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color, border: `1px solid ${color}` }}>{domain.replaceAll('_', ' ')}</span>
}

function Avatar({ name }) {
  return <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-bright)] text-xl font-black">{(name ?? '?').slice(0, 1)}</div>
}

function Spinner() {
  return <div className="flex min-h-96 items-center justify-center"><span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">refresh</span></div>
}

function AccessDenied() {
  return <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 font-bold">Access Denied</p>
}

function ErrorCard({ message }) {
  return <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm font-bold text-[var(--color-error)]">{message}</div>
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-'
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '-'
}
