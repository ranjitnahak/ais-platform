import { useNavigate } from 'react-router-dom';

function NavPickerIcon({ icon, active, destructive }) {
  const color = destructive
    ? 'var(--color-error)'
    : active
      ? 'var(--color-primary)'
      : 'var(--color-on-surface-variant)';

  return (
    <span
      className="material-symbols-outlined shrink-0 leading-none"
      style={{
        fontSize: 22,
        fontVariationSettings: active && !destructive ? "'FILL' 1" : undefined,
        color,
      }}
    >
      {icon}
    </span>
  );
}

/**
 * Reusable navigation picker list.
 * @param {{ icon: string, label: string, to?: string, subtitle?: string, destructive?: boolean, onClick?: () => void }[]} items
 * @param {(item) => boolean} [isActive]
 * @param {() => void} [onNavigate] — called after navigation (e.g. close sheet)
 * @param {React.ReactNode} [footer] — e.g. Log out row with top border
 * @param {string} [className]
 * @param {boolean} [compact] — denser padding for sheets
 */
export default function NavPicker({ items, isActive, onNavigate, footer, className = '', compact = false }) {
  const navigate = useNavigate();

  const handleSelect = (item) => {
    if (item.onClick) {
      item.onClick();
      onNavigate?.(item);
      return;
    }
    if (item.to) {
      navigate(item.to);
      onNavigate?.(item);
    }
  };

  return (
    <div className={className}>
      <ul className="list-none p-0 m-0">
        {items.map((item, index) => {
          const active = !item.destructive && isActive?.(item);
          const pad = compact ? 'px-6 py-4' : 'px-4 py-4';
          return (
            <li key={item.to ?? item.label}>
              {index > 0 && (
                <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
              )}
              <button
                type="button"
                className={`flex w-full items-center gap-4 text-left transition-colors hover:bg-[var(--color-surface-container)] ${pad} ${
                  item.destructive ? 'hover:bg-[var(--color-error-container)]/15' : ''
                }`}
                onClick={() => handleSelect(item)}
              >
                <NavPickerIcon icon={item.icon} active={!!active} destructive={!!item.destructive} />
                <div className="min-w-0 flex-1">
                  <span
                    className="block text-sm font-bold tracking-tight"
                    style={{
                      color: item.destructive
                        ? 'var(--color-error)'
                        : active
                          ? 'var(--color-primary)'
                          : 'var(--color-on-surface)',
                    }}
                  >
                    {item.label}
                  </span>
                  {item.subtitle ? (
                    <span className="mt-0.5 block truncate text-xs text-[var(--color-on-surface-variant)]">
                      {item.subtitle}
                    </span>
                  ) : null}
                </div>
                {!item.destructive && (
                  <span
                    className="material-symbols-outlined shrink-0 text-[var(--color-on-surface-variant)]"
                    style={{ fontSize: 20 }}
                    aria-hidden
                  >
                    chevron_right
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {footer ? (
        <>
          <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
          {footer}
        </>
      ) : null}
    </div>
  );
}
