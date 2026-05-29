import AISLogo from './AISLogo';

export default function AppLoadingScreen() {
  return (
    <div
      className="app-loading-screen"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-surface)',
        gap: '16px',
      }}
    >
      <AISLogo size={64} />
      <div className="app-loading-progress" aria-hidden="true">
        <div className="app-loading-progress-shimmer" />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--color-on-surface-variant)',
          fontFamily: 'var(--font-body)',
        }}
      >
        Loading...
      </p>
    </div>
  );
}
