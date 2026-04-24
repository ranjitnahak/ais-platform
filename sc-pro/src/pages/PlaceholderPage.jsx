export default function PlaceholderPage({ title }) {
  return (
    <div style={{ padding: 'var(--space-container)' }}>
      <h1 className="sc-headline" style={{ marginTop: 0 }}>
        {title}
      </h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: 480 }}>
        This area is reserved for a future S&amp;C Pro release. Use the sidebar to open the Programme Library.
      </p>
    </div>
  )
}
