import AISLogo from './AISLogo';

export default function DashboardPanelHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <AISLogo size={36} />
        <div>
          <h1 className="text-lg font-black tracking-tight text-[var(--color-on-surface)]">{title}</h1>
          {subtitle && (
            <p className="text-xs text-[var(--color-on-surface-variant)]">{subtitle}</p>
          )}
        </div>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
