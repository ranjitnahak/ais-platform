/**
 * Horizontal scrollable pill-tab strip.
 * Active: primary fill. Inactive: neutral surface tint.
 */
export default function PillTabs({ tabs, activeTab, onTabChange, onTabHover, className = '' }) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto rounded-2xl bg-[var(--color-surface-container)] p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            onPointerEnter={onTabHover ? () => onTabHover(tab.id) : undefined}
            onFocus={onTabHover ? () => onTabHover(tab.id) : undefined}
            className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-black uppercase tracking-widest transition-colors ${
              active
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
