export default function AssistantMessage({ role, content, timestamp }) {
  const isUser = role === 'user'
  const time =
    typeof timestamp === 'number'
      ? new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '92%',
          padding: '10px 12px',
          borderRadius: 12,
          background: isUser ? '#F97316' : 'var(--color-surface-high)',
          color: isUser ? '#fff' : 'var(--color-text)',
          fontSize: 13,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </div>
      {time ? (
        <span className="sc-body-sm" style={{ marginTop: 4, color: 'var(--color-text-muted)', fontSize: 10 }}>
          {time}
        </span>
      ) : null}
    </div>
  )
}
