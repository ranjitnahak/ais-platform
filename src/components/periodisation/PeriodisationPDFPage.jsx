/**
 * PeriodisationPDFPage
 * Pure presentational component. Renders one page-chunk of the plan for PDF capture.
 * Sized exactly at A4 landscape (1122 × 794 px) so html2canvas captures cleanly.
 * Light background — deliberately separate from the dark canvas theme.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import PeriodisationPDFHeader from './PeriodisationPDFHeader';
import { rowMetricKey, numberCellStyle, peakingStyle, acwrStyle } from '../../lib/periodisationUtils';
import { findSpanningCell, getCellForWeek, rowUsesSpanInteraction } from './cellUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const PAGE_W = 1122;
const PAGE_H = 794;
const LABEL_COL = 140;
const HEADER_H = 56;
const CHART_H = 130;
const ROW_H = 22;
const GROUP_HEADER_H = 18;

/** Width of the grid area for this page's weeks */
function colWidth(weekCount) {
  return Math.floor((PAGE_W - LABEL_COL) / weekCount);
}

/** Resolve the effective cell value for a given row + week (patches not needed in PDF context) */
function resolveCell(row, monday, cells) {
  if (rowUsesSpanInteraction(row)) return findSpanningCell(row.id, monday, cells, {});
  return getCellForWeek(row.id, monday, cells, {});
}

/** Group rows by their row_group preserving order */
function groupRows(rows) {
  const order = [];
  const map = {};
  for (const r of rows) {
    const g = r.row_group || 'Planning';
    if (!map[g]) { map[g] = []; order.push(g); }
    map[g].push(r);
  }
  return order.map((g) => ({ group: g, rows: map[g] }));
}

function BandRow({ row, weeks, cells, cw }) {
  const first = weeks[0].monday;
  const last = weeks[weeks.length - 1].monday;
  // Collect all cells that overlap this page's week range
  const spans = cells.filter(
    (c) =>
      c.row_id === row.id &&
      c.value_text &&
      c.cell_date <= last &&
      (c.span_end_date || c.cell_date) >= first,
  );

  return (
    <div style={{ position: 'relative', width: weeks.length * cw, height: ROW_H - 2, background: 'var(--pdf-cell-empty-bg)' }}>
      {spans.map((cell) => {
        const spanEnd = cell.span_end_date || cell.cell_date;
        // Clamp to this page's range
        const startIdx = weeks.findIndex((w) => w.monday >= cell.cell_date);
        const clampedStart = startIdx === -1 ? 0 : startIdx;
        const endIdx = weeks.findIndex((w) => w.monday > spanEnd);
        const clampedEnd = endIdx === -1 ? weeks.length - 1 : endIdx - 1;
        const spanWeeks = clampedEnd - clampedStart + 1;
        if (spanWeeks <= 0) return null;
        const bg = cell.value_color || cell.color || 'var(--color-secondary-container)';
        const showLabel = spanWeeks > 2;
        return (
          <div
            key={cell.id || cell.cell_date}
            style={{
              position: 'absolute',
              left: clampedStart * cw,
              width: spanWeeks * cw - 1,
              top: 2,
              height: ROW_H - 6,
              borderRadius: 3,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 4,
              overflow: 'hidden',
            }}
          >
            {showLabel && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--pdf-bg)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: spanWeeks * cw - 8,
                }}
              >
                {cell.value_text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NumberCell({ value, style: st }) {
  const s = st || numberCellStyle(value);
  return (
    <div
      style={{
        width: '100%',
        height: ROW_H - 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: s.bg,
        color: s.text,
        fontSize: 9,
        fontWeight: 700,
        borderRadius: 2,
      }}
    >
      {value ?? ''}
    </div>
  );
}

function MarkerCell({ cell }) {
  if (!cell) return <div style={{ width: '100%', height: ROW_H - 2 }} />;
  const color = cell.value_color || cell.color || 'var(--color-primary-container)';
  return (
    <div style={{ width: '100%', height: ROW_H - 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
    </div>
  );
}

function ToggleCell({ cell }) {
  const isOn = cell && (cell.value_text === 'ON' || cell.value_number === 1 || cell.value_text);
  if (!isOn) return <div style={{ width: '100%', height: ROW_H - 2 }} />;
  return (
    <div style={{ width: '100%', height: ROW_H - 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 99,
          background: 'var(--color-tertiary-container)',
          color: 'var(--color-on-tertiary-container)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        ON
      </span>
    </div>
  );
}

export default function PeriodisationPDFPage({
  weeks,
  rows,
  cells,
  planName,
  teamName,
  dateRange,
  pageNumber,
  totalPages,
  orgLogoUrl,
  secondaryLogoUrl,
  showLoadWave,
  loadWaveData,
  isLastPage,
}) {
  const cw = colWidth(weeks.length);
  const gridH = isLastPage && showLoadWave
    ? PAGE_H - HEADER_H - CHART_H - 8
    : PAGE_H - HEADER_H - 8;

  const groups = groupRows(rows);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#374151', font: { size: 9 } } },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        ticks: { color: '#6b7280', maxRotation: 0, font: { size: 8 } },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
      y: {
        min: 0,
        max: 10,
        ticks: { color: '#6b7280', font: { size: 8 } },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
    },
  };

  // loadWaveData is already pre-sliced to this page's week range by PeriodisationPDFExport
  const pageChartData = loadWaveData
    ? {
        labels: loadWaveData.labels ?? weeks.map((_, i) => `W${i + 1}`),
        datasets: [
          {
            label: 'Volume',
            data: loadWaveData.volume ?? [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
          {
            label: 'Intensity',
            data: loadWaveData.intensity ?? [],
            borderColor: 'var(--color-primary-container)',
            backgroundColor: 'rgba(249,115,22,0.06)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
          {
            label: 'ACWR',
            data: (loadWaveData.acwr ?? []).map((v) => (v == null ? null : Math.min(10, v * 4))),
            borderColor: '#22c55e',
            borderDash: [5, 4],
            fill: false,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      }
    : null;

  return (
    <div
      style={{
        width: PAGE_W,
        height: PAGE_H,
        background: 'var(--pdf-bg)',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <PeriodisationPDFHeader
        planName={planName}
        teamName={teamName}
        dateRange={dateRange}
        pageNumber={pageNumber}
        totalPages={totalPages}
        orgLogoUrl={orgLogoUrl}
        secondaryLogoUrl={secondaryLogoUrl}
      />

      {/* Grid area */}
      <div
        style={{
          display: 'flex',
          overflow: 'hidden',
          height: gridH,
          borderBottom: '1px solid var(--pdf-border)',
        }}
      >
        {/* Frozen label column */}
        <div
          style={{
            width: LABEL_COL,
            flexShrink: 0,
            borderRight: '2px solid var(--pdf-border)',
            background: 'var(--pdf-bg)',
            overflowY: 'hidden',
          }}
        >
          {/* Column header */}
          <div
            style={{
              height: GROUP_HEADER_H,
              background: 'var(--pdf-cell-empty-bg)',
              borderBottom: '1px solid var(--pdf-border)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 6,
              fontSize: 8,
              fontWeight: 700,
              color: 'var(--pdf-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Row
          </div>
          {groups.map(({ group, rows: gRows }) => (
            <div key={group}>
              {/* Group header */}
              <div
                style={{
                  height: GROUP_HEADER_H,
                  background: 'var(--pdf-group-header-bg)',
                  borderBottom: '1px solid var(--pdf-border)',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 6,
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--pdf-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {gRows[0]?.display_label || group}
              </div>
              {gRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    height: ROW_H,
                    borderBottom: '1px solid var(--pdf-border)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8,
                    paddingRight: 4,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: 'var(--pdf-text)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: LABEL_COL - 12,
                    }}
                  >
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Week grid */}
        <div style={{ flex: 1, overflowX: 'hidden', overflowY: 'hidden' }}>
          {/* Week header row */}
          <div style={{ display: 'flex', height: GROUP_HEADER_H, borderBottom: '1px solid var(--pdf-border)' }}>
            {weeks.map((w) => (
              <div
                key={w.monday}
                style={{
                  width: cw,
                  flexShrink: 0,
                  height: GROUP_HEADER_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--pdf-text-muted)',
                  borderRight: '1px solid var(--pdf-border)',
                  background: 'var(--pdf-cell-empty-bg)',
                }}
              >
                {new Date(w.monday + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </div>
            ))}
          </div>

          {/* Row groups */}
          {groups.map(({ group, rows: gRows }) => (
            <div key={group}>
              {/* Group spacer to align with label column group header */}
              <div
                style={{
                  display: 'flex',
                  height: GROUP_HEADER_H,
                  background: 'var(--pdf-group-header-bg)',
                  borderBottom: '1px solid var(--pdf-border)',
                }}
              >
                {weeks.map((w) => (
                  <div
                    key={w.monday}
                    style={{ width: cw, flexShrink: 0, borderRight: '1px solid var(--pdf-border)' }}
                  />
                ))}
              </div>

              {gRows.map((row) => {
                const rk = rowMetricKey(row);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'flex',
                      height: ROW_H,
                      borderBottom: '1px solid var(--pdf-border)',
                    }}
                  >
                    {row.row_type === 'band' || row.row_type === 'text' ? (
                      <div style={{ display: 'flex', width: weeks.length * cw, position: 'relative' }}>
                        <BandRow row={row} weeks={weeks} cells={cells} cw={cw} />
                      </div>
                    ) : (
                      weeks.map((w, wi) => {
                        const cell = resolveCell(row, w.monday, cells);
                        return (
                          <div
                            key={w.monday}
                            style={{
                              width: cw,
                              flexShrink: 0,
                              height: ROW_H,
                              borderRight: '1px solid var(--pdf-border)',
                              padding: '1px 2px',
                            }}
                          >
                            {row.row_type === 'number' && (
                              <NumberCell value={cell?.value_number ?? null} />
                            )}
                            {row.row_type === 'auto' && rk === 'acwr' && (
                              <NumberCell
                                value={
                                  loadWaveData?.acwr?.[wi] != null
                                    ? loadWaveData.acwr[wi].toFixed(2)
                                    : null
                                }
                                style={acwrStyle(loadWaveData?.acwr?.[wi] ?? null)}
                              />
                            )}
                            {row.row_type === 'auto' && rk !== 'acwr' && (
                              <NumberCell
                                value={cell?.value_number ?? null}
                                style={peakingStyle(cell?.value_number ?? null)}
                              />
                            )}
                            {row.row_type === 'marker' && <MarkerCell cell={cell} />}
                            {row.row_type === 'toggle' && <ToggleCell cell={cell} />}
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Load wave chart — last page only */}
      {isLastPage && showLoadWave && pageChartData && (
        <div
          style={{
            height: CHART_H,
            padding: '4px 14px 6px',
            background: 'var(--pdf-bg)',
            borderTop: '1px solid var(--pdf-border)',
          }}
        >
          <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--pdf-text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Load Wave
          </div>
          <div style={{ height: CHART_H - 20 }}>
            <Line data={pageChartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
