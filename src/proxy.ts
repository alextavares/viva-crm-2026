import { type NextRequest } from 'next/server'
import { NextResponse } from "next/server"
import { updateSession } from '@/lib/supabase/middleware'

function normalizeHost(v: string) {
    const host = v.trim().toLowerCase()
    const noPort = host.split(":")[0]
    return noPort.replace(/\.$/, "")
}

async function resolveSlugByDomain(domain: string): Promise<string | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null

    try {
        const res = await fetch(`${url}/rest/v1/rpc/site_resolve_slug_by_domain`, {
            method: "POST",
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ p_domain: domain }),
            cache: "no-store",
        })
        if (!res.ok) return null
        const data = await res.json()
        return typeof data === "string" && data.trim().length > 0 ? data : null
    } catch {
        return null
    }
}

function slugFromPreviewHost(host: string) {
    // Local/dev friendly preview using lvh.me (resolves to 127.0.0.1).
    // Example: demo-vivacrm.lvh.me -> slug "demo-vivacrm"
    const lower = host.toLowerCase()
    const suffixes = [".lvh.me", ".localhost"]
    for (const suf of suffixes) {
        if (lower.endsWith(suf)) {
            const sub = lower.slice(0, -suf.length)
            const slug = sub.split(".").pop() || ""
            return slug.trim() ? slug : null
        }
    }

    // Production preview host: <slug>.<preview_base>
    // Example: demo-vivacrm.sites.vivacrm.com.br -> slug "demo-vivacrm"
    const previewBase = normalizeHost(process.env.SITES_PREVIEW_BASE || process.env.SITES_CNAME_TARGET || "sites.vivacrm.com.br")
    if (previewBase && lower.endsWith(`.${previewBase}`)) {
        const sub = lower.slice(0, -(previewBase.length + 1))
        const slug = sub.split(".").pop() || ""
        return slug.trim() ? slug : null
    }

    return null
}

export async function proxy(request: NextRequest) {
    const forwardedHost = request.headers.get("x-forwarded-host")
    const hostHeader = request.headers.get("host")
    const host = normalizeHost(forwardedHost || hostHeader || "")

    const appPrimary = normalizeHost(process.env.APP_PRIMARY_DOMAIN || "vivacrm.com.br")
    const appAlt = normalizeHost(process.env.APP_ALT_DOMAIN || `www.${appPrimary}`)
    const isLocal = host === "localhost" || host === "127.0.0.1"
    const isAppHost = isLocal || host === appPrimary || host === appAlt || host.endsWith(".vercel.app")

    // Canonical host redirect (apex -> www) as permanent redirect for SEO.
    if (!isLocal && host === appPrimary && appAlt && appAlt !== appPrimary) {
        const url = request.nextUrl.clone()
        url.protocol = "https"
        url.host = appAlt
        return NextResponse.redirect(url, 308)
    }

    // For preview subdomains and customer domains, serve the public site with clean URLs (no /s/[slug] in the browser).
    if (host && !isAppHost) {
        const previewSlug = slugFromPreviewHost(host)
        const slug = previewSlug || (await resolveSlugByDomain(host))
        if (slug) {
            const pathname = request.nextUrl.pathname

            // If user hits an internal /s/[slug] URL on a custom domain, redirect to the clean path.
            const prefix = `/s/${slug}`
            if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
                const rest = pathname.slice(prefix.length) || "/"
                const url = request.nextUrl.clone()
                url.pathname = rest
                return NextResponse.redirect(url)
            }

            // Do not rewrite Next/static, API, or host-aware robots endpoint.
            if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/robots.txt") {
                return NextResponse.next()
            }

            const url = request.nextUrl.clone()
            url.pathname = pathname === "/" ? prefix : `${prefix}${pathname}`
            return NextResponse.rewrite(url)
        }
    }

    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
