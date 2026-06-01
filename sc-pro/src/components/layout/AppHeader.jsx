import TeamSwitcher from './TeamSwitcher.jsx';

export default function AppHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minHeight: 56,
        padding: '0 var(--space-container)',
        borderBottom: '1px solid var(--color-border)',
        background: 'color-mix(in srgb, var(--color-bg) 92%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <TeamSwitcher />
    </header>
  );
}
