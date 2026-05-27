import { useEffect, useRef, useState } from 'react';

export default function AdminUserRowMenu({ item, actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="rounded p-1 text-[var(--color-outline)] hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-on-surface)]"
        aria-label="User actions"
      >
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] py-1 shadow-xl">
          {actions
            .filter((action) => !action.hidden)
            .map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  action.onClick(item);
                }}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  action.variant === 'danger'
                    ? 'text-[var(--color-error)] hover:bg-[var(--color-error-container)]/20'
                    : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]'
                }`}
              >
                {action.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
