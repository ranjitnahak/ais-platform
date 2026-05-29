/**
 * Shimmer placeholder block for skeleton layouts.
 * @param {{ className?: string, style?: import('react').CSSProperties }} props
 */
export default function SkeletonBone({ className = '', style }) {
  return <div className={`skeleton-bone ${className}`.trim()} style={style} />;
}
