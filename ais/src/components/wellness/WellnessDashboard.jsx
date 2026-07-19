import { useCallback, useState } from 'react'
import { exportWellnessDashboardPDF } from '../../lib/exportWellnessPDF'
import { WELLNESS_METRIC_COLUMNS, WELLNESS_SORE_AREA_LABEL } from '../../lib/wellnessDashboardConstants'
import { WELLNESS_DASHBOARD_RANGE_OPTIONS } from '../../lib/dashboardDateRange'
import { useUser } from '../../context/UserContext'
import { useWellnessDateRange } from '../../hooks/useWellnessDateRange'
import WellnessTrend from './WellnessTrend'
import ExportPdfButton from '../shared/ExportPdfButton'
import DashboardPanelHeader from '../shared/DashboardPanelHeader'
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton'
import DashboardDateRangeFilter from '../shared/DashboardDateRangeFilter'
import ZoneMetricBadge from '../shared/ZoneMetricBadge'
import { getWellnessZone } from '../../lib/zoneBadge'

export default function WellnessDashboard({ embedded = false }) {
  const { user } = useUser()
  const {
    canView,
    loading,
    error,
    filters,
    setRangeFilter,
    setCustomDateRange,
    athletes,
    logs,
    athleteViews,
    summary,
    isSingleDay,
    dateFrom,
    dateTo,
    dateRangeLabel,
  } = useWellnessDateRange()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [wellnessView, setWellnessView] = useState('grid')

  const handleExportPDF = useCallback(async () => {
    if (exporting || loading || error) return
    setExporting(true)
    setExportError(null)
    try {
      await exportWellnessDashboardPDF({
        user,
        orgLogoUrl: user?.orgLogoUrl ?? null,
        athletes,
        logs,
        summary: {
          submitted: summary.submitted,
          total: summary.total,
          average: summary.average,
          flagged: summary.flagged,
        },
      })
    } catch (err) {
      console.error('[WellnessDashboard] PDF export failed:', err)
      setExportError(err?.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }, [exporting, loading, error, user, athletes, logs, summary])

  if (!canView) {
    return (
      <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 text-sm font-bold text-[var(--color-on-surface-variant)]">
        You do not have permission to view wellness data.
      </p>
    )
  }

  const content = (
    <div className="mx-auto max-w-6xl space-y-6">
      {embedded ? (
        <DashboardPanelHeader
          title="Wellness Dashboard"
          subtitle={user?.orgName || '—'}
          exportSlot={(
            <div data-pdf-exclude>
              <ExportPdfButton
                onClick={handleExportPDF}
                disabled={loading || !!error || !athletes.length}
                exporting={exporting}
                error={exportError}
              />
            </div>
          )}
        />
      ) : (
        <header>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Team Readiness</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Wellness Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            {isSingleDay
              ? 'Wellness submissions for the selected day.'
              : 'Wellness averages across the selected date range.'}
          </p>
        </header>
      )}

      <div data-pdf-exclude className="lg:ml-auto lg:flex lg:justify-end">
        <DashboardDateRangeFilter
          range={filters.range}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          dateRangeLabel={dateRangeLabel}
          onRangeChange={setRangeFilter}
          onCustomDatesChange={setCustomDateRange}
          options={WELLNESS_DASHBOARD_RANGE_OPTIONS}
        />
      </div>

      {!loading && (
        <section className="grid gap-3 rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4 sm:grid-cols-3">
          <SummaryTile label={summary.submittedLabel} value={summary.submittedDisplay} />
          <SummaryTile
            label="Average Score"
            value={summary.average == null ? '—' : Number(summary.average).toFixed(1)}
          />
          <SummaryTile label={summary.flaggedLabel} value={summary.flaggedDisplay} />
        </section>
      )}

      {loading && <div data-pdf-exclude><DashboardSkeleton contentOnly /></div>}

      {error && (
        <div data-pdf-exclude className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[var(--color-text-muted)]">
            {isSingleDay
              ? `${summary.submitted} of ${summary.total} submitted`
              : `${summary.submittedDisplay} avg daily`}
          </p>
          <div data-pdf-exclude>
            <WellnessViewToggle wellnessView={wellnessView} onChange={setWellnessView} />
          </div>
        </div>
      )}

      {!loading && wellnessView === 'grid' && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {athleteViews.map((view) => (
            <AthleteCard
              key={view.athlete.id}
              view={view}
              isSingleDay={isSingleDay}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          ))}
        </section>
      )}

      {!loading && wellnessView === 'table' && (
        <WellnessTable athleteViews={athleteViews} isSingleDay={isSingleDay} />
      )}
    </div>
  )

  if (embedded) return content

  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)] md:ml-64 md:px-8">
      {content}
    </main>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[var(--color-on-surface)]">{value}</p>
    </div>
  )
}

function AthleteCard({ view, isSingleDay, dateFrom, dateTo }) {
  const { athlete, score, status, flagged, sorenessAreas } = view
  const hasScore = score != null
  return (
    <article className={`min-h-48 rounded-3xl border p-4 ${hasScore || !isSingleDay ? 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]' : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-variant)] opacity-70'}`}>
      <div className="flex items-center gap-3">
        {athlete.photo_url ? (
          <img src={athlete.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] text-sm font-black text-[var(--color-on-surface)]">
            {(athlete.full_name ?? '?').slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black">{athlete.full_name}</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">{status}</p>
        </div>
        {isSingleDay && flagged && <span className="material-symbols-outlined text-[var(--color-error)]">flag</span>}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {score == null
          ? <span className="rounded-full bg-[var(--color-surface)] px-3 py-2 text-xs font-black text-[var(--color-outline)]">{isSingleDay ? 'Not submitted' : '—'}</span>
          : <ScoreBadge score={score} />}
        <WellnessTrend athleteId={athlete.id} dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      {isSingleDay && sorenessAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sorenessAreas.map((area) => (
            <span
              key={area}
              className="rounded-full bg-[var(--color-error-container)] px-2 py-0.5 text-[9px] font-bold text-[var(--color-error)]"
            >
              {area}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

function ScoreBadge({ score }) {
  const zone = getWellnessZone(score)
  return <ZoneMetricBadge zone={zone}>{score.toFixed(1)}</ZoneMetricBadge>
}

function athleteInitials(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

function WellnessViewToggle({ wellnessView, onChange }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={wellnessView === 'grid'}
        onClick={() => onChange('grid')}
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{
          background: wellnessView === 'grid' ? 'var(--color-primary)' : 'transparent',
          color: wellnessView === 'grid' ? 'white' : 'var(--color-text-muted)',
        }}
      >
        <i className="ti ti-layout-grid text-base leading-none" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={wellnessView === 'table'}
        onClick={() => onChange('table')}
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{
          background: wellnessView === 'table' ? 'var(--color-primary)' : 'transparent',
          color: wellnessView === 'table' ? 'white' : 'var(--color-text-muted)',
        }}
      >
        <i className="ti ti-table text-base leading-none" aria-hidden />
      </button>
    </div>
  )
}

function MetricPill({ value, inverse }) {
  if (value == null || !Number.isFinite(Number(value))) {
    return <span className="text-[var(--color-text-muted)]">—</span>
  }
  const zone = getWellnessZone(value, { inverse })
  return <ZoneMetricBadge zone={zone}>{value}</ZoneMetricBadge>
}

function SoreAreaCell({ areas }) {
  const list = Array.isArray(areas) ? areas.filter(Boolean) : []
  if (!list.length) {
    return <span className="text-[var(--color-text-muted)]">—</span>
  }
  return (
    <span className="inline-block max-w-[10rem] truncate rounded-full bg-[var(--color-error-container)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-error)]">
      {list.join(', ')}
    </span>
  )
}

function WellnessTable({ athleteViews, isSingleDay }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]" style={{ borderBottomWidth: '0.5px' }}>
            <th className="sticky left-0 z-20 min-w-[11rem] bg-[var(--color-surface-container)] px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Athlete
            </th>
            {WELLNESS_METRIC_COLUMNS.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-3 py-2 text-center text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {col.label}
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-2 text-center text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              {WELLNESS_SORE_AREA_LABEL}
            </th>
          </tr>
        </thead>
        <tbody>
          {athleteViews.map((view) => {
            const { athlete, responses } = view
            if (isSingleDay && !view.log) {
              return (
                <tr
                  key={athlete.id}
                  className="opacity-40"
                  style={{ borderBottom: '0.5px solid var(--color-border)', cursor: 'default' }}
                >
                  <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-black text-[var(--color-on-surface)]">
                        {athleteInitials(athlete.full_name)}
                      </div>
                      <span className="truncate font-bold text-[var(--color-on-surface)]">{athlete.full_name}</span>
                    </div>
                  </td>
                  <td
                    colSpan={WELLNESS_METRIC_COLUMNS.length + 1}
                    className="px-3 py-2.5 text-center text-xs font-bold text-[var(--color-text-muted)]"
                  >
                    Not submitted
                  </td>
                </tr>
              )
            }
            if (!isSingleDay && view.score == null && !responses) {
              return (
                <tr
                  key={athlete.id}
                  className="opacity-40"
                  style={{ borderBottom: '0.5px solid var(--color-border)', cursor: 'default' }}
                >
                  <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-black text-[var(--color-on-surface)]">
                        {athleteInitials(athlete.full_name)}
                      </div>
                      <span className="truncate font-bold text-[var(--color-on-surface)]">{athlete.full_name}</span>
                    </div>
                  </td>
                  {WELLNESS_METRIC_COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-center text-[var(--color-text-muted)]">
                      —
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center text-[var(--color-text-muted)]">—</td>
                </tr>
              )
            }
            const metricResponses = responses ?? {}
            return (
              <tr
                key={athlete.id}
                className="hover:bg-[var(--color-surface-hover)]"
                style={{ borderBottom: '0.5px solid var(--color-border)', cursor: 'default' }}
              >
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2.5 hover:bg-[var(--color-surface-hover)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-black text-[var(--color-on-surface)]">
                      {athleteInitials(athlete.full_name)}
                    </div>
                    <span className="truncate font-bold text-[var(--color-on-surface)]">{athlete.full_name}</span>
                  </div>
                </td>
                {WELLNESS_METRIC_COLUMNS.map((col) => (
                  <td key={col.key} className="px-3 py-2.5 text-center">
                    <MetricPill value={metricResponses[col.key]} inverse={col.inverse} />
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  {isSingleDay
                    ? <SoreAreaCell areas={metricResponses.soreness_areas} />
                    : <span className="text-[var(--color-text-muted)]">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
