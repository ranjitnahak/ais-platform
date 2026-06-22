import { useState } from 'react';
import { SLOT_HEIGHT } from '../../lib/weeklyTimeGrid';

export default function TimeSlotCell({
  top,
  timeLabel,
  dayIso,
  canEdit,
  pasteMode = false,
  pasteLabel = null,
  onCreate,
  onPaste,
  onContextMenu,
}) {
  const [hovered, setHovered] = useState(false);

  if (!canEdit) return null;

  return (
    <div
      className="pointer-events-auto absolute left-0 right-0 z-[1]"
      style={{ top, height: SLOT_HEIGHT, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        e.stopPropagation();
        if (pasteMode && onPaste?.({ date: dayIso, startTime: timeLabel })) return;
        onCreate({ date: dayIso, startTime: timeLabel });
      }}
    >
      {hovered && (
        <div
          className="mx-0.5 flex h-full items-center justify-center rounded"
          style={{
            background: pasteMode
              ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
              : 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
            outline: pasteMode
              ? '1px dashed color-mix(in srgb, var(--color-primary) 50%, transparent)'
              : '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
            color: 'var(--color-primary-container)',
          }}
        >
          <span className="truncate px-1 text-[10px] opacity-80">
            {pasteMode ? pasteLabel ?? 'Paste' : '+'}
          </span>
        </div>
      )}
    </div>
  );
}
