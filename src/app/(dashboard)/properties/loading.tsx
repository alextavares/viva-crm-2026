import { Skeleton } from "@/components/ui/skeleton"

export default function PropertiesLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-9 w-32" />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
            </div>

            {/* Property cards grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border overflow-hidden">
                        <Skeleton className="h-48 w-full" />
                        <div className="p-4 space-y-3">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <div className="flex gap-4">
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                            <Skeleton className="h-6 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
