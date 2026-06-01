import { BACK_BODY_OUTLINE, FRONT_BODY_OUTLINE, getRegionsForView } from './bodyMapRegions';

export default function BodyMapFigure({ view, value = [], onToggle, readOnly = false }) {
  const regions = getRegionsForView(view);
  const outline = view === 'front' ? FRONT_BODY_OUTLINE : BACK_BODY_OUTLINE;
  const selectedSet = new Set(value);

  return (
    <svg
      viewBox="0 0 100 190"
      className="mx-auto w-full max-w-[160px]"
      role="img"
      aria-label={view === 'front' ? 'Front body map' : 'Back body map'}
    >
      <path
        d={outline}
        fill="var(--color-surface)"
        stroke="var(--color-outline)"
        strokeWidth="1.5"
        pointerEvents="none"
      />
      {regions.map((region) => {
        const selected = selectedSet.has(region.id);
        return (
          <path
            key={region.id}
            d={region.path}
            fill={selected ? 'var(--color-error-container)' : 'rgba(255,255,255,0.01)'}
            stroke={selected ? 'var(--color-error)' : 'var(--color-outline-variant)'}
            strokeWidth={selected ? 1.5 : 0.75}
            className={readOnly ? '' : 'cursor-pointer'}
            style={{ touchAction: 'manipulation' }}
            onClick={() => {
              if (readOnly || !onToggle) return;
              onToggle(region.id);
            }}
          >
            {!readOnly && <title>{region.id}</title>}
          </path>
        );
      })}
    </svg>
  );
}
