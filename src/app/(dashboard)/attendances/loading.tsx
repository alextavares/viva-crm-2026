export default function AttendancesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted/30" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border bg-muted/30" />
    </div>
  )
}
