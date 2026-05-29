import SkeletonBone from './SkeletonBone';

export default function AthletesSkeleton({ className = '' }) {
  return (
    <div className={`space-y-6 ${className}`.trim()} aria-busy="true" aria-label="Loading athletes">
      <SkeletonBone style={{ height: 44, width: '100%', borderRadius: 8 }} />

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBone key={i} style={{ height: 28, width: 88, borderRadius: 9999 }} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonBone key={i} style={{ height: 168, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );
}
