import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_GAP_PX = 4;
const MENU_MIN_WIDTH_PX = 140;

function useMenuCoords(open, triggerRef, menuRef) {
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }
    const trigger = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 160;
    const spaceBelow = window.innerHeight - trigger.bottom;
    const openUp = spaceBelow < menuHeight + MENU_GAP_PX && trigger.top > menuHeight + MENU_GAP_PX;
    const top = openUp ? trigger.top - menuHeight - MENU_GAP_PX : trigger.bottom + MENU_GAP_PX;
    setCoords({
      top,
      left: Math.max(8, trigger.right - MENU_MIN_WIDTH_PX),
      minWidth: MENU_MIN_WIDTH_PX,
    });
  }, [open, triggerRef, menuRef]);

  return coords;
}

export default function AdminUserRowMenu({ item, actions }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const coords = useMenuCoords(open, triggerRef, menuRef);

  useEffect(() => {
    if (!open) return;
    function close(event) {
      const target = event.target;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onViewportChange() {
      setOpen(false);
    }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  const visibleActions = actions.filter((action) => !action.hidden);

  const menu = open && coords
    ? createPortal(
        <div
          ref={menuRef}
          data-admin-row-menu=""
          className="fixed z-[200] rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] py-1 shadow-xl"
          style={{ top: coords.top, left: coords.left, minWidth: coords.minWidth }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {visibleActions.map((action) => (
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
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-admin-row-menu-trigger=""
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="rounded p-1 text-[var(--color-outline)] hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-on-surface)]"
        aria-label="User actions"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </button>
      {menu}
    </>
  );
}
