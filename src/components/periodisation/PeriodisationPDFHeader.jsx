/**
 * PeriodisationPDFHeader
 * Pure presentational component. Renders the top strip on every PDF page.
 * Intentionally isolated so future tasks can add conditional branding without
 * touching the export orchestrator or page layout component.
 */
export default function PeriodisationPDFHeader({
  planName,
  teamName,
  dateRange,
  pageNumber,
  totalPages,
  orgLogoUrl,
  secondaryLogoUrl,
}) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: 'var(--pdf-bg)' }}>
      {/* Three-column header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          gap: 12,
          background: 'var(--pdf-bg)',
        }}
      >
        {/* Left: IIS logo + JSW Sports logo side by side */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '0 0 auto',
            minWidth: 120,
          }}
        >
          {orgLogoUrl && (
            <img
              src={orgLogoUrl}
              alt="Organisation logo"
              crossOrigin="anonymous"
              style={{ height: 28, objectFit: 'contain', display: 'block' }}
            />
          )}
          {secondaryLogoUrl && (
            <img
              src={secondaryLogoUrl}
              alt="Secondary logo"
              crossOrigin="anonymous"
              style={{ height: 28, objectFit: 'contain', display: 'block' }}
            />
          )}
          {!orgLogoUrl && !secondaryLogoUrl && (
            <span
              style={{
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: '0.1em',
                color: 'var(--pdf-text)',
                textTransform: 'uppercase',
              }}
            >
              AIS
            </span>
          )}
        </div>

        {/* Centre: plan name (large) + team name (muted, smaller) stacked */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 13,
              color: 'var(--pdf-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              lineHeight: 1.2,
            }}
          >
            {planName}
          </div>
          {teamName && (
            <div
              style={{
                fontSize: 9,
                color: 'var(--pdf-text-muted)',
                marginTop: 1,
                fontWeight: 500,
              }}
            >
              {teamName}
            </div>
          )}
        </div>

        {/* Right: date range + Page X of Y */}
        <div
          style={{
            textAlign: 'right',
            flex: '0 0 auto',
            minWidth: 120,
          }}
        >
          <div style={{ fontSize: 9, color: 'var(--pdf-text-muted)' }}>{dateRange}</div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--pdf-text)',
              marginTop: 2,
            }}
          >
            Page {pageNumber} of {totalPages}
          </div>
        </div>
      </div>

      {/* Thin primary-colour horizontal rule */}
      <div
        style={{
          height: 2,
          background: 'var(--color-primary-container)',
        }}
      />
    </div>
  );
}
