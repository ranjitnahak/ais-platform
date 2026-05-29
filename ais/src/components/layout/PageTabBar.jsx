export default function PageTabBar({ tabs, activeTab, onTabChange, onTabHover }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl bg-[var(--color-surface-container)] p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          onPointerEnter={onTabHover ? () => onTabHover(tab.id) : undefined}
          onFocus={onTabHover ? () => onTabHover(tab.id) : undefined}
          className={`min-h-11 flex-1 rounded-xl px-3 text-xs font-black uppercase tracking-widest transition-colors ${
            activeTab === tab.id
              ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
