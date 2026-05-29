/**
 * Single source of truth for the AIS brand mark.
 * @param {{ size?: number }} props
 */
export default function AISLogo({ size = 56 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="AIS"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="80" height="80" rx="18" fill="var(--color-primary-container)" />
      <text
        x="40"
        y="52"
        textAnchor="middle"
        fontSize="28"
        fontWeight="700"
        fill="var(--color-surface)"
        letterSpacing="-1"
        fontFamily="Inter, system-ui, sans-serif"
      >
        AIS
      </text>
    </svg>
  );
}
