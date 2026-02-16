import { Skeleton } from "@/components/ui/skeleton"

export default function ContactsLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-4 w-52" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Search */}
            <Skeleton className="h-9 w-full max-w-sm" />

            {/* Table rows */}
            <div className="rounded-lg border">
                <div className="p-4 border-b">
                    <div className="flex gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="p-4 border-b last:border-b-0">
                        <div className="flex gap-4 items-center">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
