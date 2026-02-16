import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PropertyCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <div className="relative aspect-video">
                <Skeleton className="h-full w-full" />
            </div>
            <CardHeader className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex gap-2 mb-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
            </CardContent>
            <CardFooter className="p-4 border-t flex justify-between items-center bg-muted/50">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </CardFooter>
        </Card>
    )
}
