import { useState } from 'react';
import { SLOT_HEIGHT } from '../../lib/weeklyTimeGrid';

export default function TimeSlotCell({ top, timeLabel, dayIso, canEdit, onCreate }) {
  const [hovered, setHovered] = useState(false);

  if (!canEdit) return null;

  return (
    <div
      className="pointer-events-auto absolute left-0 right-0 z-[1]"
      style={{ top, height: SLOT_HEIGHT, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onCreate({ date: dayIso, startTime: timeLabel });
      }}
    >
      {hovered && (
        <div
          className="mx-0.5 flex h-full items-center justify-center rounded"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
            outline: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
            color: 'var(--color-primary-container)',
          }}
        >
          <span className="text-[10px] opacity-60">+</span>
        </div>
      )}
    </div>
  );
}
