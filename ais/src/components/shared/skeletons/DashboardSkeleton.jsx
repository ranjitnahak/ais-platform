import SkeletonBone from './SkeletonBone';

function DashboardContentSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBone style={{ height: 112, borderRadius: 16 }} />
        <SkeletonBone style={{ height: 112, borderRadius: 16 }} />
      </div>

      <SkeletonBone style={{ height: 112, width: '100%', borderRadius: 16 }} />

      <div className="grid grid-cols-2 gap-3">
        <SkeletonBone style={{ height: 192, borderRadius: 24 }} />
        <SkeletonBone style={{ height: 192, borderRadius: 24 }} />
      </div>
    </>
  );
}

export default function DashboardSkeleton({ className = '', contentOnly = false }) {
  return (
    <div className={`space-y-6 ${className}`.trim()} aria-busy="true" aria-label="Loading dashboard">
      {!contentOnly && (
        <>
          <div className="space-y-2 lg:hidden">
            <SkeletonBone style={{ height: 24, width: '55%', borderRadius: 8 }} />
            <SkeletonBone style={{ height: 14, width: '72%', borderRadius: 6 }} />
          </div>

          <div className="flex flex-wrap gap-2">
            <SkeletonBone style={{ height: 44, flex: '1 1 30%', minWidth: 80, borderRadius: 12 }} />
            <SkeletonBone style={{ height: 44, flex: '1 1 30%', minWidth: 80, borderRadius: 12 }} />
            <SkeletonBone style={{ height: 44, flex: '1 1 30%', minWidth: 80, borderRadius: 12 }} />
          </div>
        </>
      )}

      <DashboardContentSkeleton />
    </div>
  );
}
