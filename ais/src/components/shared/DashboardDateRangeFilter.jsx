import { DASHBOARD_RANGE_OPTIONS } from '../../lib/dashboardDateRange';

const dateInputClass =
  'min-h-9 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-on-surface)] outline-none';

export default function DashboardDateRangeFilter({
  range,
  dateFrom,
  dateTo,
  dateRangeLabel,
  onRangeChange,
  onCustomDatesChange,
}) {
  const isCustom = range === 'custom';

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex rounded-full border border-[var(--color-outline-variant)] p-0.5">
          {DASHBOARD_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRangeChange(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                range === option.value
                  ? 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]'
                  : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!isCustom && dateRangeLabel && (
          <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">
            {dateRangeLabel}
          </span>
        )}
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            type="date"
            value={dateFrom ?? ''}
            onChange={(e) => onCustomDatesChange({ dateFrom: e.target.value, dateTo })}
            className={dateInputClass}
            aria-label="Start date"
          />
          <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">–</span>
          <input
            type="date"
            value={dateTo ?? ''}
            onChange={(e) => onCustomDatesChange({ dateFrom, dateTo: e.target.value })}
            className={dateInputClass}
            aria-label="End date"
          />
          {dateRangeLabel && (
            <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">
              {dateRangeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
