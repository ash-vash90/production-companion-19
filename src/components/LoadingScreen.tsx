import { Skeleton } from "@/components/ui/skeleton";

const LoadingScreen = () => {
  return (
    <div className="min-h-screen w-full bg-background">
      {/* Skeleton sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-64 border-r border-border bg-card p-4 flex-col gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2 mt-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className="mt-auto">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
      
      {/* Main content skeleton */}
      <div className="md:ml-64 p-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-20 w-full rounded-md" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;