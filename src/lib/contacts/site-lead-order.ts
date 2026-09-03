type SiteLeadSortable = {
  id: string
  latestLeadAt?: string | null
  created_at?: string | null
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function sortByLatestLeadActivity<T extends SiteLeadSortable>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const activityDiff =
      toTimestamp(right.latestLeadAt ?? right.created_at) -
      toTimestamp(left.latestLeadAt ?? left.created_at)

    if (activityDiff !== 0) return activityDiff

    const createdDiff = toTimestamp(right.created_at) - toTimestamp(left.created_at)
    if (createdDiff !== 0) return createdDiff

    return left.id.localeCompare(right.id)
  })
}
