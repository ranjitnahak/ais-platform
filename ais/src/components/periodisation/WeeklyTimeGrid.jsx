import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COLLAPSED_HEIGHT,
  HOUR_HEIGHT,
  buildGridRows,
  defaultScrollOffset,
  formatTimeLabel,
  offsetToTime,
  timeToOffset,
  totalGridHeight,
} from '../../lib/weeklyTimeGrid';
import SessionCalBlock from './SessionCalBlock';
import TimeSlotCell from './TimeSlotCell';

export default function WeeklyTimeGrid({
  days,
  sessions,
  canEdit,
  clipboardSessionName = null,
  dragOverDay,
  dragSession,
  suppressClickRef,
  onCreateSlot,
  onPasteSlot,
  onOpenSession,
  onStartDrag,
  onContextMenuDay,
  onContextMenuSession,
  onOffsetToTime,
  gridRef,
}) {
  const scrollRef = useRef(null);
  const [expandedZones, setExpandedZones] = useState({});

  const gridRows = useMemo(
    () => buildGridRows(sessions, expandedZones),
    [sessions, expandedZones],
  );

  const visibleSlots = useMemo(() => {
    const slots = [];
    for (const row of gridRows) {
      if (row.type !== 'hour') continue;
      for (const minute of [0, 30]) {
        const timeLabel = formatTimeLabel(row.hour, minute);
        slots.push({
          timeLabel,
          top: timeToOffset(`${timeLabel}:00`, gridRows),
        });
      }
    }
    return slots;
  }, [gridRows]);

  const sessionsLayoutKey = useMemo(
    () =>
      sessions
        .map((s) => `${s.id}:${s.session_date}:${s.start_time}:${s.duration_planned ?? ''}`)
        .sort()
        .join('|'),
    [sessions],
  );

  useEffect(() => {
    setExpandedZones({});
  }, [sessionsLayoutKey]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = defaultScrollOffset(sessions, gridRows);
  }, [sessions, gridRows]);

  useEffect(() => {
    if (!onOffsetToTime) return;
    onOffsetToTime((offsetPx) => offsetToTime(offsetPx, gridRows));
  }, [gridRows, onOffsetToTime]);

  const gridHeight = totalGridHeight(gridRows);

  return (
    <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
      <div ref={gridRef} className="relative" style={{ minHeight: gridHeight }}>
        <div
          className="pointer-events-none grid"
          style={{ gridTemplateColumns: '38px repeat(7, minmax(0,1fr))' }}
        >
          {gridRows.flatMap((row) => {
            if (row.type === 'collapsed') {
              return buildCollapsedGridRows(row, () =>
                setExpandedZones((zones) => ({
                  ...zones,
                  [row.zoneKey]: true,
                })),
              );
            }
            if (row.type === 'expanded-collapse') {
              return [
                <CollapsedZoneCollapseBar
                  key={`collapse-${row.zoneKey}`}
                  bar={row}
                  onCollapse={() =>
                    setExpandedZones((zones) => {
                      const next = { ...zones };
                      delete next[row.zoneKey];
                      return next;
                    })
                  }
                />,
              ];
            }
            return [<HourGridRow key={`hour-${row.hour}`} hour={row.hour} />];
          })}
        </div>

        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: '38px repeat(7, minmax(0,1fr))' }}
        >
          <div />
          {days.map((day) => (
            <div
              key={day.iso}
              data-day-iso={day.iso}
              className={`pointer-events-none relative ${
                dragOverDay === day.iso
                  ? 'bg-[color-mix(in_srgb,var(--color-primary-container)_10%,transparent)]'
                  : ''
              }`}
              style={{ minHeight: gridHeight }}
              onContextMenu={(e) => onContextMenuDay(e, day.iso)}
            >
              {visibleSlots.map((slot) => (
                <TimeSlotCell
                  key={slot.timeLabel}
                  top={slot.top}
                  timeLabel={slot.timeLabel}
                  dayIso={day.iso}
                  canEdit={canEdit}
                  pasteMode={Boolean(clipboardSessionName) && !dragSession}
                  pasteLabel={clipboardSessionName ? `Paste: ${clipboardSessionName}` : null}
                  onCreate={onCreateSlot}
                  onPaste={onPasteSlot}
                  onContextMenu={(e) => {
                    if (clipboardSessionName) onContextMenuDay(e, day.iso);
                  }}
                />
              ))}
              {sessions
                .filter((session) => session.session_date === day.iso)
                .map((session) => (
                  <SessionCalBlock
                    key={session.id}
                    session={session}
                    gridRows={gridRows}
                    isDragging={dragSession?.id === session.id}
                    onOpen={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      onOpenSession(day.iso, session.id);
                    }}
                    onPointerDown={(e) => onStartDrag(e, session)}
                    onContextMenu={(e) => onContextMenuSession(e, session)}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildCollapsedGridRows(row, onExpand) {
  return [
    <div key={`${row.zoneKey}-gutter`} />,
    <div
      key={`${row.zoneKey}-bar`}
      className="pointer-events-auto flex cursor-pointer items-center justify-center border-b border-white/10"
      style={{
        gridColumn: '2 / -1',
        height: row.heightPx,
        background: 'var(--color-surface-container-low)',
      }}
      onClick={onExpand}
    >
      <span className="text-center text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatTimeLabel(row.fromHour)}–{formatTimeLabel(row.toHour)} · no sessions · click to expand
      </span>
    </div>,
  ];
}

function CollapsedZoneCollapseBar({ bar, onCollapse }) {
  return (
    <>
      <div />
      <div
        className="pointer-events-auto flex cursor-pointer items-center justify-center border-b border-white/10"
        style={{
          gridColumn: '2 / -1',
          height: COLLAPSED_HEIGHT,
          background: 'var(--color-surface-container-low)',
        }}
        onClick={onCollapse}
      >
        <span className="text-center text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatTimeLabel(bar.fromHour)}–{formatTimeLabel(bar.toHour)} · no sessions · click to collapse
        </span>
      </div>
    </>
  );
}

function HourGridRow({ hour }) {
  return (
    <>
      <div
        className="border-b border-r border-white/10 pr-1 pt-1 text-right text-[8px]"
        style={{
          height: HOUR_HEIGHT,
          background: 'var(--color-surface-container-low)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {formatTimeLabel(hour)}
      </div>
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          className="border-b border-r border-white/10 last:border-r-0"
          style={{ height: HOUR_HEIGHT }}
        />
      ))}
    </>
  );
}
