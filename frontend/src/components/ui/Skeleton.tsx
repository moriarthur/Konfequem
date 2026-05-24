interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} {...props} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-surface-base border border-border-subtle rounded-xl p-4">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function RoomCardSkeleton() {
  return (
    <div className="bg-surface-base border border-border-subtle rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

export function BookingListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-base border border-border-subtle rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
      <Skeleton className="h-7 w-12 mx-auto mb-1" />
      <Skeleton className="h-3 w-20 mx-auto" />
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Month nav */}
        <div className="bg-surface-base border border-border-subtle rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border-subtle">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-2 py-3 text-center">
                <Skeleton className="h-3 w-6 mx-auto" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[70px] sm:min-h-[100px] border-r border-b border-border-subtle p-1 sm:p-2">
                <Skeleton className="h-4 w-4 mb-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="bg-surface-base border border-border-subtle rounded-xl p-5 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-4 last:mb-0">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
