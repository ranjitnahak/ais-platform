import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { canSync, useCurrentUser } from '../lib/auth'

function Spinner() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent animate-spin" />
    </div>
  )
}

function parseAthleteParas(aiText) {
  if (!aiText) return {}
  const map = {}
  const lines = aiText.split('\n')
  let currentName = null
  let currentText = []
  for (const line of lines) {
    const match = line.match(/^\*\*([^*]+)\*\*:?\s*(.*)/)
    if (match) {
      if (currentName) map[currentName.trim().toLowerCase()] = currentText.join(' ').trim()
      currentName = match[1].replace(/\(.*\)/, '').replace(/:$/, '').trim()
      currentText = match[2] ? [match[2]] : []
    } else if (currentName && line.trim()) {
      currentText.push(line.trim())
    }
  }
  if (currentName) map[currentName.trim().toLowerCase()] = currentText.join(' ').trim()
  return map
}

function parseTeamSummary(aiText) {
  if (!aiText) return ''
  const summaryMatch = aiText.match(/(?:TEAM SUMMARY|Team Summary|OVERALL)[:\s]*\n([\s\S]+)$/i)
  return summaryMatch ? summaryMatch[1].trim() : ''
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
  return String(text ?? '').replace(/\*\*/g, '').split('\n').filter((line) => line.trim())
}

function fileName(value) {
  return String(value ?? 'team').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')
}

function lastParagraph(text) {
  const lines = paragraphLines(text)
  return lines.length ? lines[lines.length - 1] : ''
}

function relation(row) {
  return Array.isArray(row) ? row[0] : row
}

function AthleteCard({ athlete, paragraph }) {
  const age = getAge(athlete?.date_of_birth)
  const text = paragraph || 'No data available for this athlete in the selected period.'
  return (
    <article className="flex gap-4 border-b border-[var(--color-outline-variant)] p-4 last:border-b-0">
      <aside className="w-[140px] shrink-0 text-center">
        {athlete?.photo_url ? (
          <img src={athlete.photo_url} alt={athlete.full_name} className="mx-auto h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="mx-auto h-20 w-20 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_20%,transparent)] flex items-center justify-center text-base font-black text-[var(--color-primary)]">
            {initials(athlete?.full_name)}
          </div>
        )}
        <h3 className="mt-3 text-[13px] font-black leading-tight text-[var(--color-on-surface)]">{athlete?.full_name ?? 'Athlete'}</h3>
        <p className="mt-1 text-[11px] text-[var(--color-on-surface-variant)]">{athlete?.position ?? 'Position not set'}</p>
        <p className="text-[11px] text-[var(--color-on-surface-variant)]">{[athlete?.gender, age ? `Age ${age}` : null].filter(Boolean).join(' · ')}</p>
      </aside>
      <div className="flex-1 pl-4 text-[13px] leading-7 text-[var(--color-on-surface-variant)]">
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
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user) return
    async function loadReport() {
      try {
        setLoading(true)
        setError(null)
        if (!canSync(user, 'unified_reports', 'view')) return
        const { data: teamReport, error: reportError } = await supabase
          .from('team_reports')
          .select('*, teams(id, name, sport, logo_url)')
          .eq('id', reportId)
          .eq('org_id', user.orgId)
          .single()
        if (reportError) throw reportError
        const { data: orgRow, error: orgError } = await supabase
          .from('organisations')
          .select('logo_url, name')
          .eq('id', user.orgId)
          .single()
        if (orgError) throw orgError
        const { data: rosterRows, error: rosterError } = await supabase
          .from('athlete_teams')
          .select('athletes!inner(id, full_name, photo_url, position, gender, date_of_birth)')
          .eq('team_id', teamReport.team_id)
          .eq('athletes.org_id', user.orgId)
        if (rosterError) throw rosterError
        setReport(teamReport)
        setOrg(orgRow)
        setAthletes((rosterRows ?? []).map((row) => relation(row.athletes)).filter(Boolean))
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
    const element = document.getElementById('report-content')
    if (!element) return
    setExporting(true)
    try {
      setExportError(null)
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1C1C1E',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      let heightLeft = pdfHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      heightLeft -= 297
      while (heightLeft > 0) {
        position -= 297
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
        heightLeft -= 297
      }
      const teamName = relation(report?.teams)?.name ?? 'team'
      const today = new Date().toISOString().split('T')[0]
      pdf.save(`report-${fileName(teamName)}-${today}.pdf`)
    } catch (err) {
      console.error('[PDF export]', err)
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const aiText = report?.section_ai_synthesis?.text ?? ''
  const athleteParas = useMemo(() => parseAthleteParas(aiText), [aiText])
  const teamSummary = parseTeamSummary(aiText) || lastParagraph(aiText)

  if (userLoading || loading) return <Spinner />
  if (!canSync(user, 'unified_reports', 'view')) return <StateMessage message="Access Denied" />
  if (error || !report) return <StateMessage message="Report not found" />

  const team = relation(report.teams)
  const logoUrl = team?.logo_url ?? org?.logo_url
  const overview = report.section_squad_overview ?? {}
  const flagged = overview.flaggedAthletes ?? []

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)] font-['Inter']">
      <style>{'@media print { .no-print { display: none !important; } }'}</style>
      <main className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <header id="report-header" className="flex flex-col gap-5 border-b border-[var(--color-outline-variant)] pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {logoUrl && <img src={logoUrl} alt={team?.name ?? org?.name ?? 'Team'} className="h-[60px] max-w-32 object-contain" />}
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
            <button onClick={handleExportPDF} disabled={exporting} className="rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-60">
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button onClick={() => navigate(-1)} className="rounded-xl border border-[var(--color-outline-variant)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)]">Back</button>
          </div>
        </header>
        {exportError && <p className="no-print mt-4 text-sm text-[var(--color-error)]">{exportError}</p>}

        <section id="report-content" className="mt-6 rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)]">
          <h2 className="border-b border-[var(--color-outline-variant)] p-4 text-lg font-black text-[var(--color-on-surface)]">Individual Athlete Reports</h2>
          {athletes.length === 0 ? (
            <p className="rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-5 text-sm text-[var(--color-on-surface-variant)]">
              No individual reports available. Generate individual athlete reports to see them here.
            </p>
          ) : (
            athletes.map((athlete) => (
              <AthleteCard
                key={athlete.id}
                athlete={athlete}
                paragraph={athleteParas[String(athlete.full_name ?? '').trim().toLowerCase()]}
              />
            ))
          )}

          <section className="p-5">
            <h2 className="text-xl font-black text-[var(--color-on-surface)]">Team Overview</h2>
            <p className="mt-3 text-sm font-bold text-[var(--color-on-surface-variant)]">
              Athletes: {overview.athleteCount ?? athletes.length} · Avg Wellness: {overview.avgWellness ?? 'n/a'} · Flagged: {flagged.length}
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--color-on-surface-variant)]">
              {paragraphLines(teamSummary).map((line, index) => <p key={index}>{line}</p>)}
            </div>
          </section>
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
