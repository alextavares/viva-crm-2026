export function getDemoSiteSlug() {
  return (process.env.NEXT_PUBLIC_DEMO_SITE_SLUG || "demo-vivacrm").trim()
}

export function getDemoSiteHref() {
  return `/s/${getDemoSiteSlug()}`
}

