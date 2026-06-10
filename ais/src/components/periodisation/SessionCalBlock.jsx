import { sessionTypeLabel, sessionTypeStyles } from '../../lib/sessionTypeStyles';
import { durationToHeight, timeToOffset } from '../../lib/weeklyTimeGrid';

const DEFAULT_AM_TIME = '06:30:00';
const SHORT_BLOCK_THRESHOLD = 40;

export default function SessionCalBlock({
  session,
  gridRows,
  onOpen,
  onPointerDown,
  onContextMenu,
  isDragging,
}) {
  const top = timeToOffset(session.start_time || DEFAULT_AM_TIME, gridRows) + 2;
  const height = durationToHeight(session.duration_planned);
  const label = sessionTypeLabel(session.session_type) || 'Session';
  const styles = sessionTypeStyles(session.session_type);
  const showAllLines = height >= SHORT_BLOCK_THRESHOLD;

  return (
    <div
      className={`pointer-events-auto absolute left-1 right-1 rounded cursor-grab active:cursor-grabbing hover:brightness-110 hover:z-10 transition-all select-none touch-none ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={{
        top,
        height,
        background: styles.bg,
        borderLeft: `3px solid ${styles.border}`,
        zIndex: 2,
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onContextMenu={onContextMenu}
    >
      <div className="flex h-full flex-col overflow-hidden p-1">
        {showAllLines && (
          <div className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            {(session.start_time || '').slice(0, 5)}
          </div>
        )}
        <div
          className="truncate text-[11px] font-medium"
          style={{ color: styles.border }}
        >
          {label}
        </div>
        {showAllLines && (
          <div className="truncate text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {session.venue || '—'}
          </div>
        )}
      </div>
    </div>
  );
}
