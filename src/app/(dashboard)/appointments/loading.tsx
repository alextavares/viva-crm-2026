import { Skeleton } from "@/components/ui/skeleton"

export default function AppointmentsLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-56" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Appointment list */}
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-5 w-36" />
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </div>
                                <div className="flex gap-4">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-4 w-28" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-8" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
