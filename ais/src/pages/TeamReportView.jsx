import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import { canSync, useCurrentUser } from '../lib/auth'

function Spinner() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent animate-spin" />
    </div>
  )
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function initials(name) {
  return String(name ?? 'A').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not set'
}

function paragraphLines(text) {
  return String(text ?? '').split('\n').filter((line) => line.trim())
}

function fileSafe(value) {
  return String(value ?? 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function AthleteCard({ report }) {
  const athlete = Array.isArray(report.athletes) ? report.athletes[0] : report.athletes
  const age = getAge(athlete?.date_of_birth)
  const text = report.section_ai_synthesis?.text ?? 'No synthesis stored for this athlete report.'
  return (
    <article className="flex gap-5 border-b border-[var(--color-outline-variant)] py-6 last:border-b-0">
      <aside className="w-32 shrink-0 text-center">
        {athlete?.photo_url ? (
          <img src={athlete.photo_url} alt={athlete.full_name} className="mx-auto h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="mx-auto h-20 w-20 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_20%,transparent)] flex items-center justify-center text-lg font-black text-[var(--color-primary)]">
            {initials(athlete?.full_name)}
          </div>
        )}
        <h3 className="mt-3 text-sm font-black leading-tight text-[var(--color-on-surface)]">{athlete?.full_name ?? 'Athlete'}</h3>
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{athlete?.position ?? 'Position not set'}</p>
        <p className="text-xs text-[var(--color-on-surface-variant)]">{[athlete?.gender, age ? `Age ${age}` : null].filter(Boolean).join(' · ')}</p>
      </aside>
      <div className="flex-1 text-sm leading-6 text-[var(--color-on-surface-variant)]">
        {paragraphLines(text).map((line, index) => <p key={index} className={index ? 'mt-3' : ''}>{line}</p>)}
      </div>
    </article>
  )
}

export default function TeamReportView() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { user, loading: userLoading } = useCurrentUser()
  const [report, setReport] = useState(null)
  const [org, setOrg] = useState(null)
  const [athleteReports, setAthleteReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    if (!user) return
    async function loadReport() {
      try {
        setLoading(true)
        setError(null)
        if (!canSync(user, 'unified_reports', 'view')) return
        const { data: teamReport, error: reportError } = await supabase
          .from('team_reports')
          .select('*, teams(id, name, sport, logo_url, org_id)')
          .eq('id', reportId)
          .eq('org_id', user.orgId)
          .single()
        if (reportError) throw reportError
        const { data: orgRow, error: orgError } = await supabase
          .from('organisations')
          .select('logo_url, secondary_logo_url, name')
          .eq('id', user.orgId)
          .single()
        if (orgError) throw orgError
        const { data: recentReports, error: athleteError } = await supabase
          .from('athlete_reports')
          .select('*, athletes(id, full_name, photo_url, position, gender, date_of_birth)')
          .eq('org_id', user.orgId)
          .order('generated_at', { ascending: false })
          .limit(30)
        if (athleteError) throw athleteError
        setReport(teamReport)
        setOrg(orgRow)
        setAthleteReports(recentReports ?? [])
      } catch (err) {
        console.error('[TeamReportView] loadReport failed:', err)
        setError('Report not found')
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [reportId, user])

  async function handleExportPDF() {
    try {
      setExportError(null)
      const element = document.getElementById('report-content')
      const teamName = team?.name ?? 'team'
      const today = new Date().toISOString().split('T')[0]
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#1C1C1E' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      let heightLeft = pdfHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
      heightLeft -= 297
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
        heightLeft -= 297
      }
      pdf.save(`team-report-${fileSafe(teamName)}-${today}.pdf`)
    } catch (err) {
      console.error('[TeamReportView] export failed:', err)
      setExportError(err.message)
    }
  }

  if (userLoading || loading) return <Spinner />
  if (!canSync(user, 'unified_reports', 'view')) return <StateMessage message="Access Denied" />
  if (error || !report) return <StateMessage message="Report not found" />

  const team = Array.isArray(report.teams) ? report.teams[0] : report.teams
  const logoUrl = team?.logo_url ?? org?.logo_url
  const overview = report.section_squad_overview ?? {}
  const flagged = overview.flaggedAthletes ?? []
  const teamSynthesis = report.section_ai_synthesis?.text

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)] font-['Inter']">
      <style>{'@media print { .no-print { display: none !important; } }'}</style>
      <main id="report-content" className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <header className="flex flex-col gap-5 border-b border-[var(--color-outline-variant)] pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {logoUrl && <img src={logoUrl} alt={team?.name ?? org?.name ?? 'Team'} className="h-16 max-w-32 object-contain" />}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-[var(--color-on-surface)] md:text-4xl">{team?.name ?? 'Team Report'}</h1>
                {team?.sport && <span className="rounded-full bg-[var(--color-primary-container)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-primary)]">{team.sport}</span>}
              </div>
              <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Report period: {report.date_range_start} to {report.date_range_end}</p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">Generated on {formatDate(report.generated_at ?? report.created_at)}</p>
            </div>
          </div>
          <div className="no-print flex gap-3">
            <button onClick={handleExportPDF} className="rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)]">Export PDF</button>
            <button onClick={() => navigate(-1)} className="rounded-xl border border-[var(--color-outline-variant)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)]">Back</button>
          </div>
        </header>
        {exportError && <p className="no-print mt-4 text-sm text-[var(--color-error)]">{exportError}</p>}

        <section className="mt-4">
          {athleteReports.length === 0 ? (
            <p className="rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-5 text-sm text-[var(--color-on-surface-variant)]">
              No individual reports available. Generate individual athlete reports to see them here.
            </p>
          ) : (
            athleteReports.map((item) => <AthleteCard key={item.id} report={item} />)
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-5">
          <h2 className="text-xl font-black text-[var(--color-on-surface)]">Team Overview</h2>
          <p className="mt-3 text-sm font-bold text-[var(--color-on-surface-variant)]">
            Athletes: {overview.athleteCount ?? athleteReports.length} · Avg Wellness: {overview.avgWellness ?? 'n/a'} · Flagged: {flagged.length}
          </p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--color-on-surface-variant)]">
            {paragraphLines(teamSynthesis).map((line, index) => <p key={index}>{line}</p>)}
          </div>
        </section>
      </main>
    </div>
  )
}

function StateMessage({ message }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)] flex items-center justify-center">
      <p className="text-lg font-black">{message}</p>
    </div>
  )
}
