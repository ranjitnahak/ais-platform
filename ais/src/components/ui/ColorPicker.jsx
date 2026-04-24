import { useCallback, useEffect, useRef, useState } from 'react';

const PRESET_ROWS = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff'],
  ['#ff0000', '#ff4444', '#ea4335', '#e06666', '#f4cccc', '#fce8e6', '#ffd7d7', '#ffebee'],
  ['#ff6d00', '#ff8f00', '#f9a825', '#f97316', '#ffd180', '#ffe0b2', '#fff3e0', '#fff8e1'],
  ['#00c853', '#2e7d32', '#388e3c', '#4caf50', '#a5d6a7', '#c8e6c9', '#e8f5e9', '#f1f8e9'],
  ['#1565c0', '#1976d2', '#2196f3', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd', '#e8eaf6'],
  ['#6a1b9a', '#7b1fa2', '#8b5cf6', '#ab47bc', '#ce93d8', '#e1bee7', '#f3e5f5', '#fce4ec'],
  ['#00695c', '#00897b', '#26a69a', '#4db6ac', '#80cbc4', '#b2dfdb', '#e0f2f1', '#e8f5e9'],
  ['#F97316', '#1C1C1E', '#3b82f6', '#22c55e', '#ef4444', '#eab308', '#8b5cf6', '#6b7280'],
];

function normalizeHex(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  let h = s.startsWith('#') ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return null;
  return `#${h.toLowerCase()}`;
}

export default function ColorPicker({ value, onChange, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value || '#000000');
  const [hoverKey, setHoverKey] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  const triggerPx = size === 'sm' ? 20 : 28;

  useEffect(() => {
    setHexDraft(value || '#000000');
  }, [value]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = 200;
    const margin = 8;
    const left = Math.min(
      r.left,
      Math.max(margin, window.innerWidth - panelW - margin)
    );
    setPanelPos({ top: r.bottom + 4, left });
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      if (!o) {
        requestAnimationFrame(() => updatePosition());
      }
      return !o;
    });
  }, [updatePosition]);

  useEffect(() => {
    if (!open) {
      setHoverKey(null);
      return;
    }
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (
        triggerRef.current?.contains(t) ||
        panelRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commitHex = useCallback(() => {
    const n = normalizeHex(hexDraft);
    if (n) onChange(n);
    else setHexDraft(value || '#000000');
  }, [hexDraft, onChange, value]);

  const selectPreset = (hex) => {
    onChange(hex);
    setHexDraft(hex);
  };

  const current = normalizeHex(value) || '#000000';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          toggleOpen();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: triggerPx,
          height: triggerPx,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.35)',
          background: current,
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      />
      {open && (
        <div
          ref={panelRef}
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            zIndex: 2000,
            top: panelPos.top,
            left: panelPos.left,
            width: 200,
            boxSizing: 'border-box',
            padding: 8,
            background: '#2a2a2c',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 20px)',
              gap: 3,
              marginBottom: 10,
            }}
          >
            {PRESET_ROWS.flatMap((row, ri) =>
              row.map((hex, ci) => {
                const key = `${ri}-${ci}`;
                const sel = current.toLowerCase() === hex.toLowerCase();
                const hovered = hoverKey === key;
                let ring =
                  '0 0 0 1px rgba(0,0,0,0.15)';
                if (sel) ring = '0 0 0 2px #F97316';
                else if (hovered) ring = '0 0 0 2px rgba(255,255,255,0.45)';
                return (
                  <button
                    key={key}
                    type="button"
                    title={hex}
                    onClick={() => selectPreset(hex)}
                    onMouseEnter={() => setHoverKey(key)}
                    onMouseLeave={() => setHoverKey((h) => (h === key ? null : h))}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: 'none',
                      background: hex,
                      cursor: 'pointer',
                      padding: 0,
                      position: 'relative',
                      boxSizing: 'border-box',
                      boxShadow: ring,
                    }}
                  >
                    {sel && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          textShadow:
                            '0 0 2px #000, 0 0 4px #000, 0 1px 2px #000',
                          pointerEvents: 'none',
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <input
            type="text"
            value={hexDraft}
            spellCheck={false}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitHex();
              }
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              fontSize: 12,
              fontFamily: 'ui-monospace, monospace',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.15)',
              background: '#1C1C1E',
              color: '#fff',
            }}
          />
        </div>
      )}
    </div>
  );
}
