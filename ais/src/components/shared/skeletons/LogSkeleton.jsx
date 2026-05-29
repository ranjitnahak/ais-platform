import SkeletonBone from './SkeletonBone';

function LogRowSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonBone key={i} style={{ height: 64, width: '100%', borderRadius: 16 }} />
      ))}
    </div>
  );
}

export default function LogSkeleton({ className = '', contentOnly = false }) {
  return (
    <div className={`mx-auto max-w-2xl space-y-5 ${className}`.trim()} aria-busy="true" aria-label="Loading log">
      {!contentOnly && (
        <>
          <SkeletonBone style={{ height: 48, width: '100%', maxWidth: 320, borderRadius: 12 }} />

          <div className="flex gap-2 rounded-2xl p-2" style={{ background: 'var(--color-surface-container)' }}>
            <SkeletonBone style={{ height: 44, flex: 1, borderRadius: 12 }} />
            <SkeletonBone style={{ height: 44, flex: 1, borderRadius: 12 }} />
          </div>
        </>
      )}

      <LogRowSkeleton />
    </div>
  );
}
