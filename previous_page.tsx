import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Users, Calendar, Globe, Target } from "lucide-react"
import { DashboardCharts } from "@/components/dashboard/dashboard-charts"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { WhatsAppOnboardingChecklist } from "@/components/dashboard/whatsapp-onboarding-checklist"
import { getWhatsAppOnboardingSnapshot } from "@/lib/whatsapp-onboarding"

type GoalsSnapshot = {
    ok: boolean
    role: string
    enabled: boolean
    period_type: "weekly" | "monthly"
    metric_captacoes_enabled?: boolean
    metric_respostas_enabled?: boolean
    metric_visitas_enabled?: boolean
    response_sla_minutes: number
    target_captacoes: number
    target_respostas: number
    target_visitas?: number
    current_captacoes: number
    current_respostas: number
    current_visitas?: number
    progress_captacoes_pct: number
    progress_respostas_pct: number
    progress_visitas_pct?: number
}

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data: profile } = user
        ? await supabase
              .from("profiles")
              .select("organization_id, role")
              .eq("id", user.id)
              .single()
        : { data: null }

    const orgId = profile?.organization_id ?? null
    const role = (profile?.role as string | null) ?? null
    const isAdmin = role === "owner" || role === "manager"

    const { data: org } = orgId
        ? await supabase.from("organizations").select("slug").eq("id", orgId).single()
        : { data: null }

    const siteSlug = (org?.slug as string | null) ?? null

    // Fetch stats in parallel
    // eslint-disable-next-line react-hooks/purity -- Server-side snapshot for dashboard metric window.
    const siteLeadsSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [propertiesResult, contactsResult, appointmentsResult, propertiesAll, contactsAll, siteSettings, publishedCount, siteLeads7d, siteLeadsAllTime, customDomain, goalsSnapshotResult, whatsappAddonSettings, whatsappChannelSettings] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('type', 'lead'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString()),
        supabase.from('properties').select('status'),
        supabase.from('contacts').select('type'),
        orgId
            ? supabase
                  .from("site_settings")
                  .select(
                      "brand_name, whatsapp, email, ga4_measurement_id, meta_pixel_id, google_site_verification, facebook_domain_verification, google_ads_conversion_id, google_ads_conversion_label, onboarding_collapsed"
                  )
                  .eq("organization_id", orgId)
                  .maybeSingle()
            : Promise.resolve({ data: null }),
        supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("status", "available")
            .eq("hide_from_site", false),
        supabase
            .from("contact_events")
            .select("id", { count: "exact", head: true })
            .eq("type", "lead_received")
            .eq("source", "site")
            .gte("created_at", siteLeadsSince),
        supabase
            .from("contact_events")
            .select("id", { count: "exact", head: true })
            .eq("type", "lead_received")
            .eq("source", "site"),
        orgId
            ? supabase
                  .from("custom_domains")
                  .select("status")
                  .eq("organization_id", orgId)
                  .maybeSingle()
            : Promise.resolve({ data: null }),
        orgId && user?.id
            ? supabase.rpc("goals_dashboard_snapshot", { p_org_id: orgId, p_profile_id: user.id })
            : Promise.resolve({ data: null, error: null }),
        orgId
            ? supabase
                  .from("whatsapp_addon_pricing_settings")
                  .select("addon_enabled")
                  .eq("organization_id", orgId)
                  .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        orgId
            ? supabase
                  .from("whatsapp_channel_settings")
                  .select("status, last_tested_at")
                  .eq("organization_id", orgId)
                  .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ])

    const activeProperties = propertiesResult.count || 0
    const activeLeads = contactsResult.count || 0
    const upcomingAppointments = appointmentsResult.count || 0
    const siteLeadsCount7d = siteLeads7d.count || 0

    const hasAnyProperty = (propertiesAll.data?.length ?? 0) > 0
    const hasPublishedProperty = (publishedCount.count ?? 0) > 0
    const hasSiteLead = (siteLeadsAllTime.count ?? 0) > 0
    const hasSiteConfigured = Boolean(
        siteSettings?.data?.brand_name?.trim() &&
            siteSettings?.data?.whatsapp?.trim() &&
            siteSettings?.data?.email?.trim()
    )
    const hasDomainVerified = customDomain?.data?.status === "verified"
    const hasPreviewReady = Boolean(siteSlug)
    const hasDomainReady = hasDomainVerified || hasPreviewReady
    const onboardingCollapsed = Boolean(siteSettings?.data?.onboarding_collapsed)
    const goalsErrorCode = goalsSnapshotResult.error?.code
    if (goalsSnapshotResult.error && goalsErrorCode !== "42883" && goalsErrorCode !== "42P01") {
        console.error("Error fetching goals snapshot:", {
            message: goalsSnapshotResult.error.message,
            details: goalsSnapshotResult.error.details,
            hint: goalsSnapshotResult.error.hint,
            code: goalsSnapshotResult.error.code,
        })
    }
    const goalsSnapshot = (goalsSnapshotResult.data as GoalsSnapshot | null) ?? null
    const whatsappOnboarding = getWhatsAppOnboardingSnapshot({
        addonEnabled: Boolean(whatsappAddonSettings.data?.addon_enabled),
        channelStatus: (whatsappChannelSettings.data?.status as "disconnected" | "connected" | "error" | null) ?? null,
        lastTestedAt: (whatsappChannelSettings.data?.last_tested_at as string | null) ?? null,
    })

    // Aggregate data for charts
    const propertyStatusCounts = (propertiesAll.data || []).reduce((acc, curr) => {
        const status = curr.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const propertiesByStatus = Object.entries(propertyStatusCounts).map(([name, value]) => ({
        name: name === 'available' ? 'Disponível' : name === 'sold' ? 'Vendido' : name === 'rented' ? 'Alugado' : name,
        value
    }))

    const contactTypeCounts = (contactsAll.data || []).reduce((acc, curr) => {
        const type = curr.type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const leadsByType = Object.entries(contactTypeCounts).map(([name, value]) => ({
        name: name === 'lead' ? 'Lead' : name === 'client' ? 'Cliente' : name === 'owner' ? 'Proprietário' : name === 'partner' ? 'Parceiro' : name,
        value
    }))

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Visão geral do seu negócio.</p>
            </div>

            <OnboardingChecklist
                siteSlug={siteSlug}
                isAdmin={isAdmin}
                hasSiteConfigured={hasSiteConfigured}
                hasAnyProperty={hasAnyProperty}
                hasPublishedProperty={hasPublishedProperty}
                hasSiteLead={hasSiteLead}
                hasDomainReady={hasDomainReady}
                initialCollapsed={onboardingCollapsed}
            />

            {isAdmin ? <WhatsAppOnboardingChecklist snapshot={whatsappOnboarding} /> : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Imóveis Disponíveis</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeProperties}</div>
                        <p className="text-xs text-muted-foreground">
                            Ativos na carteira
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads Ativos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeLeads}</div>
                        <p className="text-xs text-muted-foreground">
                            Potenciais clientes
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Visitas Agendadas</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{upcomingAppointments}</div>
                        <p className="text-xs text-muted-foreground">
                            Próximos compromissos
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads do Site (7 dias)</CardTitle>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{siteLeadsCount7d}</div>
                        <p className="text-xs text-muted-foreground">
                            Captações via formulário público
                        </p>
                    </CardContent>
                </Card>
            </div>

            {goalsSnapshot?.ok ? (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suas Metas ({goalsSnapshot.period_type === "monthly" ? "mensal" : "semanal"})</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!goalsSnapshot.enabled ? (
                            <p className="text-sm text-muted-foreground">
                                Metas desativadas para seu perfil. Peça ao owner/manager para ativar em Configurações &gt; Metas.
                            </p>
                        ) : (
                            <>
                                {goalsSnapshot.metric_captacoes_enabled !== false ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Captações</span>
                                            <span className="font-medium">
                                                {goalsSnapshot.current_captacoes}/{goalsSnapshot.target_captacoes}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{ width: `${Math.max(0, Math.min(100, goalsSnapshot.progress_captacoes_pct || 0))}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                {goalsSnapshot.metric_respostas_enabled !== false ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Respostas rápidas</span>
                                            <span className="font-medium">
                                                {goalsSnapshot.current_respostas}/{goalsSnapshot.target_respostas}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-emerald-500 transition-all"
                                                style={{ width: `${Math.max(0, Math.min(100, goalsSnapshot.progress_respostas_pct || 0))}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            SLA da resposta rápida: {goalsSnapshot.response_sla_minutes} min.
                                        </p>
                                    </div>
                                ) : null}

                                {goalsSnapshot.metric_visitas_enabled !== false ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Visitas agendadas</span>
                                            <span className="font-medium">
                                                {goalsSnapshot.current_visitas ?? 0}/{goalsSnapshot.target_visitas ?? 0}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-sky-500 transition-all"
                                                style={{ width: `${Math.max(0, Math.min(100, goalsSnapshot.progress_visitas_pct || 0))}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                {goalsSnapshot.metric_captacoes_enabled === false &&
                                goalsSnapshot.metric_respostas_enabled === false &&
                                goalsSnapshot.metric_visitas_enabled === false ? (
                                    <p className="text-sm text-muted-foreground">
                                        Todas as métricas estão desativadas para seu perfil.
                                    </p>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : null}
            <DashboardCharts propertiesByStatus={propertiesByStatus} leadsByType={leadsByType} />
        </div>
    )
}
