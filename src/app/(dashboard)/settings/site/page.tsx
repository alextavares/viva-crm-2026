import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { SiteAdmin } from "@/components/site/site-admin"
import { SiteContentAdmin } from "@/components/site/site-content-admin"
import { Button } from "@/components/ui/button"

type OrgInfo = { id: string; name: string; slug: string }
type SiteChecklist = {
  hasPublicProperty: boolean
  hasSiteLead: boolean
}

function normalizeHost(v: string) {
  const host = v.trim().toLowerCase()
  return host.replace(/\.$/, "")
}

function getPreviewUrlForOrg(slug: string, requestHost: string, forwardedProto: string | null) {
  const host = normalizeHost(requestHost)
  const hostNoPort = host.split(":")[0]
  const port = host.includes(":") ? host.split(":")[1] : "3015"

  if (hostNoPort === "localhost" || hostNoPort === "127.0.0.1") {
    const proto = (forwardedProto?.split(",")[0] || "http").trim()
    return `${proto}://${slug}.lvh.me:${port}`
  }

  const previewBase = process.env.SITES_PREVIEW_BASE || process.env.SITES_CNAME_TARGET || "sites.vivacrm.com.br"
  return `https://${slug}.${previewBase}`
}

export default async function SiteSettingsPage() {
  const supabase = await createClient()
  const reqHeaders = await headers()
  const requestHost = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host") || "localhost:3015"
  const forwardedProto = reqHeaders.get("x-forwarded-proto")

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Site Público</h1>
        <p className="text-muted-foreground">Não foi possível identificar sua organização.</p>
      </div>
    )
  }

  const role = (profile.role as string | null) ?? null
  const isAdmin = role === "owner" || role === "manager"

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", profile.organization_id)
    .single()

  if (!org) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Site Público</h1>
        <p className="text-muted-foreground">Organização não encontrada.</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Site Público</h1>
          <p className="text-muted-foreground">
            Apenas <span className="font-medium">owner/manager</span> podem editar o site.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  const [{ data: settings }, { data: pages }, { data: banners }, { data: domain }, { count: publicCount }, { count: siteLeadCount }, { data: news }, { data: links }] = await Promise.all([
    supabase.from("site_settings").select("*").eq("organization_id", org.id).maybeSingle(),
    supabase
      .from("site_pages")
      .select("*")
      .eq("organization_id", org.id)
      .order("key", { ascending: true }),
    supabase
      .from("site_banners")
      .select("*")
      .eq("organization_id", org.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("custom_domains").select("*").eq("organization_id", org.id).maybeSingle(),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("status", "available")
      .eq("hide_from_site", false),
    supabase
      .from("contact_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("type", "lead_received")
      .eq("source", "site"),
    supabase
      .from("site_news")
      .select("*")
      .eq("organization_id", org.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("site_links")
      .select("*")
      .eq("organization_id", org.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ])

  return (
    <div className="grid gap-8">
      <SiteAdmin
        org={org as OrgInfo}
        previewUrl={getPreviewUrlForOrg(org.slug, requestHost, forwardedProto)}
        checklist={{
          hasPublicProperty: (publicCount ?? 0) > 0,
          hasSiteLead: (siteLeadCount ?? 0) > 0,
        } as SiteChecklist}
        initial={{
          settings: settings ?? null,
          pages: (pages ?? []) as unknown as Array<Record<string, unknown>>,
          banners: (banners ?? []) as unknown as Array<Record<string, unknown>>,
          domain: (domain ?? null) as unknown as Record<string, unknown> | null,
        }}
      />
      <SiteContentAdmin
        org={org as OrgInfo}
        initial={{
          news: (news ?? []) as unknown as Array<{
            id: string
            organization_id: string
            title: string
            slug: string
            excerpt: string | null
            content: string
            is_published: boolean
            published_at: string | null
            created_at: string
            updated_at: string
          }>,
          links: (links ?? []) as unknown as Array<{
            id: string
            organization_id: string
            title: string
            url: string
            description: string | null
            sort_order: number
            is_published: boolean
            created_at: string
            updated_at: string
          }>,
        }}
      />
    </div>
  )
}
