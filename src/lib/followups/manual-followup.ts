export function formatManualFollowupSource(description: string) {
    return `manual: ${description.trim().slice(0, 500)}`
}

export function parseManualFollowupDescription(source: string | null) {
    if (!source) return null
    const marker = "manual:"
    if (!source.toLowerCase().startsWith(marker)) return null
    return source.slice(marker.length).trim() || null
}
