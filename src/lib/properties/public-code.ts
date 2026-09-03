export function generatePropertyPublicCode() {
    const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
    return `V-${hex}`
}
