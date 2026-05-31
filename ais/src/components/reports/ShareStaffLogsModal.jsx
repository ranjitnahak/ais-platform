import { formatRangeLabel, initials } from '../../lib/staffLogsConstants';
import { STAFF_LOGS_REPORT_TYPE } from '../../lib/staffLogsShare';

function LogoBadge({ src, alt, fallback }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-12 w-12 rounded-full object-cover"
        style={{ border: '1px solid var(--color-outline-variant)' }}
      />
    );
  }
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-black text-[var(--color-primary)]"
      style={{ background: 'var(--color-surface-variant)' }}
    >
      {fallback}
    </div>
  );
}

export default function ShareStaffLogsModal({
  team,
  org,
  dateFrom,
  dateTo,
  shareUrl,
  copying,
  onCopyLink,
  onShareNative,
  onClose,
}) {
  const teamName = team?.name ?? 'Team';
  const rangeLabel = formatRangeLabel(dateFrom, dateTo);
  const aisLogo = org?.logo_url ?? '/favicon.svg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-staff-logs-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Share report
            </p>
            <h2 id="share-staff-logs-title" className="text-xl font-black text-[var(--color-on-surface)]">
              Link ready
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="material-symbols-outlined text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            aria-label="Close"
          >
            close
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-outline-variant)] px-4 py-3">
            <LogoBadge
              src={team?.logo_url}
              alt={teamName}
              fallback={initials(teamName)}
            />
            <LogoBadge
              src={aisLogo}
              alt="AIS"
              fallback="AI"
            />
          </div>
          <div className="space-y-2 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">
              {STAFF_LOGS_REPORT_TYPE}
            </p>
            <p className="text-lg font-black text-[var(--color-on-surface)]">{teamName}</p>
            {team?.sport && (
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                {team.sport}
              </p>
            )}
            <p className="text-sm text-[var(--color-on-surface-variant)]">{rangeLabel}</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-[var(--color-on-surface-variant)]">
          Only logged-in staff in your organisation can open this link.
        </p>

        <div className="mt-4 break-all rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-3 py-2 text-xs text-[var(--color-on-surface-variant)]">
          {shareUrl}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={copying}
            onClick={onCopyLink}
            className="rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-60"
          >
            {copying ? 'Copying…' : 'Copy link'}
          </button>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              disabled={copying}
              onClick={onShareNative}
              className="rounded-xl border border-[var(--color-outline-variant)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)] disabled:opacity-60"
            >
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
