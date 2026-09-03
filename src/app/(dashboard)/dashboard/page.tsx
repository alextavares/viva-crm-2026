import { createClient } from "@/lib/supabase/server"
import { SalesFunnel } from "@/components/dashboard/sales-funnel"
import { DEAL_STAGES, type DealStage } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Building, Users, Calendar, Globe, Target } from "lucide-react"
import Link from "next/link"
import { DashboardCharts } from "@/components/dashboard/dashboard-charts"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { WhatsAppOnboardingChecklist } from "@/components/dashboard/whatsapp-onboarding-checklist"
import { AiLeadsMetrics } from "@/components/ai-leads/ai-leads-metrics"
import { loadAiLeadOperationsMetrics } from "@/lib/ai-leads/metrics"
import { getWhatsAppOnboardingSnapshot } from "@/lib/whatsapp-onboarding"
import {
    loadLeadAttributionMetrics,
    type AttributionPeriod,
} from "@/lib/analytics/lead-attribution"
import { LeadAttributionCard } from "@/components/analytics/lead-attribution-card"
import {
    loadOperationalFunnelMetrics,
    type FunnelPeriod,
} from "@/lib/analytics/operational-funnel"
import { OperationalFunnelCard } from "@/components/analytics/operational-funnel-card"
import {
    type LeadDistributionSettings,
} from "@/components/contacts/contacts-grid"
import {
    getPropertyOperationalSnapshot,
    getPropertyOperationalStatusLabel,
    type PropertyOperationalStatus,
} from "@/lib/property-operational-readiness"
import { getPropertyVitrineStatus } from "@/lib/property-vitrine-status"

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

type DashboardPropertyRow = {
    id: string
    public_code?: string | null
    external_id?: string | null
    title?: string | null
    type?: string | null
    transaction_type?: string | null
    price?: number | null
    description?: string | null
    assigned_to?: string | null
    status?: string | null
    hide_from_site?: boolean | null
    publish_to_portals?: boolean | null
    publish_zap?: boolean | null
    publish_imovelweb?: boolean | null
    publish_olx?: boolean | null
    images?: string[] | null
    image_paths?: string[] | null
    features?: Record<string, unknown> | null
    address?: Record<string, unknown> | null
}

const PROPERTY_HEALTH_ORDER: PropertyOperationalStatus[] = [
    "published_high_quality",
    "published_low_quality",
    "publishable",
    "draft",
]

const PROPERTY_HEALTH_BADGE_CLASS: Record<PropertyOperationalStatus, string> = {
    published_high_quality: "bg-emerald-100 text-emerald-800 border-emerald-200",
    published_low_quality: "bg-amber-50 text-amber-800 border-amber-200",
    publishable: "bg-sky-100 text-sky-800 border-sky-200",
    draft: "bg-slate-100 text-slate-800 border-slate-200",
}

type DashboardPageProps = {
    searchParams: Promise<{ attributionPeriod?: string; funnelPeriod?: string }>
}

type BrokerUpcomingAppointment = {
    id: string
    date: string
    status: string | null
    propertyTitle: string | null
    contactName: string | null
}

type OwnerAttendanceLoad = {
    id: string
    name: string
    overdueCount: number
    newCount: number
}

function getDashboardSlaLabel(
    lastLeadAt: string | null,
    status: string,
    settings: LeadDistributionSettings,
    nowMs: number
) {
    if (!lastLeadAt || status !== "new" || !settings.enabled) return null

    const dt = new Date(lastLeadAt)
    if (Number.isNaN(dt.getTime())) return null

    const elapsedMinutes = Math.max(0, Math.floor((nowMs - dt.getTime()) / 60000))
    const slaMinutes = Math.max(1, settings.sla_minutes || 15)
    const warnThreshold = Math.max(1, Math.floor(slaMinutes * 0.66))

    if (elapsedMinutes <= warnThreshold) return "No prazo"
    if (elapsedMinutes <= slaMinutes) return "Atenção"
    return "Atrasado"
}

function parseAttributionPeriod(value: string | undefined): AttributionPeriod {
    return value === "today" || value === "7d" || value === "30d" ? value : "7d"
}

function parseFunnelPeriod(value: string | undefined): FunnelPeriod {
    return value === "today" || value === "7d" || value === "30d" ? value : "7d"
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const sp = await searchParams
    const attributionPeriod = parseAttributionPeriod(sp.attributionPeriod)
    const funnelPeriod = parseFunnelPeriod(sp.funnelPeriod)
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
    const isBroker = role === "broker"

    const { data: org } = orgId
        ? await supabase.from("organizations").select("slug").eq("id", orgId).single()
        : { data: null }

    const siteSlug = (org?.slug as string | null) ?? null

    const loadSiteSettings = async () => {
        if (!orgId) return { data: null, error: null }

        const preferred = await supabase
            .from("site_settings")
            .select(
                "brand_name, whatsapp, email, ga4_measurement_id, meta_pixel_id, google_site_verification, facebook_domain_verification, google_ads_conversion_id, google_ads_conversion_label, onboarding_collapsed, whatsapp_onboarding_collapsed"
            )
            .eq("organization_id", orgId)
            .maybeSingle()

        if (!preferred.error) {
            return preferred
        }

        const errorMessage =
            `${preferred.error.code ?? ""} ${preferred.error.message ?? ""} ${preferred.error.details ?? ""} ${preferred.error.hint ?? ""}`.trim()
        const isMissingWhatsAppOnboardingColumn =
            /whatsapp_onboarding_collapsed|schema cache|PGRST204|42703/i.test(errorMessage)

        if (!isMissingWhatsAppOnboardingColumn) {
            console.error("Error loading dashboard site settings:", preferred.error)
            return { data: null, error: null }
        }

        const fallback = await supabase
            .from("site_settings")
            .select(
                "brand_name, whatsapp, email, ga4_measurement_id, meta_pixel_id, google_site_verification, facebook_domain_verification, google_ads_conversion_id, google_ads_conversion_label, onboarding_collapsed"
            )
            .eq("organization_id", orgId)
            .maybeSingle()

        if (fallback.error) {
            console.error("Error loading dashboard site settings fallback:", fallback.error)
            return { data: null, error: null }
        }

        if (fallback.data) {
            return {
                data: {
                    ...fallback.data,
                    whatsapp_onboarding_collapsed: false,
                },
                error: null,
            }
        }

        return { data: null, error: null }
    }

    // Fetch stats in parallel
    // eslint-disable-next-line react-hooks/purity -- Server-side snapshot for dashboard metric window.
    const siteLeadsSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [propertiesResult, , appointmentsResult, propertiesAll, contactsAll, contactsDealStages, siteSettings, publishedCount, , siteLeadsAllTime, customDomain, leadDistributionSettingsResult, goalsSnapshotResult, whatsappAddonSettings, whatsappChannelSettings, aiLeadMetricsResult, attributionMetrics, operationalFunnelMetrics, brokerSiteLeadEventsResult, brokerAppointmentsResult] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('type', 'lead'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString()),
        supabase.from('properties').select('id, public_code, external_id, title, type, transaction_type, price, description, assigned_to, status, hide_from_site, publish_to_portals, publish_zap, publish_imovelweb, publish_olx, images, image_paths, features, address'),
        supabase.from('contacts').select('type'),
        supabase.from('contacts').select('deal_stage, type'),
        loadSiteSettings(),
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
        supabase
            .from("lead_distribution_settings")
            .select("sla_minutes, enabled")
            .maybeSingle(),
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
        isAdmin ? loadAiLeadOperationsMetrics(supabase, orgId) : Promise.resolve(null),
        isAdmin ? loadLeadAttributionMetrics(supabase, orgId, attributionPeriod) : Promise.resolve(null),
        isAdmin ? loadOperationalFunnelMetrics(supabase, orgId, funnelPeriod) : Promise.resolve(null),
        isBroker && orgId
            ? supabase
                  .from("contact_events")
                  .select("contact_id, created_at")
                  .eq("organization_id", orgId)
                  .eq("type", "lead_received")
                  .eq("source", "site")
                  .order("created_at", { ascending: false })
                  .limit(5000)
            : Promise.resolve({ data: null, error: null }),
        isBroker && orgId && user?.id
            ? supabase
                  .from("appointments")
                  .select("id, date, status, properties(title), contacts(name)")
                  .eq("organization_id", orgId)
                  .eq("assigned_to", user.id)
                  .eq("status", "scheduled")
                  .gte("date", new Date().toISOString())
                  .order("date", { ascending: true })
                  .limit(8)
            : Promise.resolve({ data: null, error: null }),
    ])

    const activeProperties = propertiesResult.count || 0
    const upcomingAppointments = appointmentsResult.count || 0
    const now = new Date()
    const nowMs = now.getTime()
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

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
    const whatsappOnboardingCollapsed = Boolean(siteSettings?.data?.whatsapp_onboarding_collapsed)
    let leadDistributionSettings: LeadDistributionSettings = {
        sla_minutes: 15,
        enabled: true,
    }
    if (leadDistributionSettingsResult.error && leadDistributionSettingsResult.error.code !== "42P01") {
        console.error("Error fetching lead_distribution_settings for dashboard:", {
            message: leadDistributionSettingsResult.error.message,
            details: leadDistributionSettingsResult.error.details,
            hint: leadDistributionSettingsResult.error.hint,
            code: leadDistributionSettingsResult.error.code,
        })
    } else if (leadDistributionSettingsResult.data) {
        leadDistributionSettings = {
            sla_minutes: leadDistributionSettingsResult.data.sla_minutes ?? 15,
            enabled: leadDistributionSettingsResult.data.enabled ?? true,
        }
    }
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

    const propertyHealthCounts = ((propertiesAll.data || []) as DashboardPropertyRow[]).reduce((acc, curr) => {
        const snapshot = getPropertyOperationalSnapshot(curr)
        acc[snapshot.status] = (acc[snapshot.status] || 0) + 1
        return acc
    }, {} as Record<PropertyOperationalStatus, number>)

    const propertyHealthRows = PROPERTY_HEALTH_ORDER.map((status) => ({
        status,
        label: getPropertyOperationalStatusLabel(status),
        count: propertyHealthCounts[status] ?? 0,
        href: `/properties?operationalStatus=${status}`,
        badgeClassName: PROPERTY_HEALTH_BADGE_CLASS[status],
    }))

    const propertyVitrineCounts = ((propertiesAll.data || []) as DashboardPropertyRow[]).reduce(
        (acc, property) => {
            const vitrine = getPropertyVitrineStatus({
                ...property,
                title: property.title ?? undefined,
                description: property.description ?? undefined,
            })
            if (vitrine.status === "live") acc.live += 1
            else if (vitrine.status === "ready_hidden") acc.ready += 1
            else if (vitrine.status === "blocked_hidden" || vitrine.status === "blocked_visible") acc.blocked += 1
            return acc
        },
        { live: 0, ready: 0, blocked: 0 }
    )

    const brokerLatestLeadByContactId = new Map<string, string>()
    for (const event of (brokerSiteLeadEventsResult.data || []) as Array<{ contact_id: string | null; created_at: string | null }>) {
        if (!event.contact_id || !event.created_at || brokerLatestLeadByContactId.has(event.contact_id)) continue
        brokerLatestLeadByContactId.set(event.contact_id, event.created_at)
    }

    let brokerSiteNewLeadsCount = 0
    let brokerPendingLeadCount = 0
    let brokerStaleLeadCount = 0
    let ownerNewSiteLeadCount = 0
    let ownerOverdueLeadCount = 0
    let ownerUnassignedLeadCount = 0
    let ownerAttendanceLoads: OwnerAttendanceLoad[] = []

    if (isAdmin && orgId) {
        const siteLeadEventsResult = await supabase
            .from("contact_events")
            .select("contact_id, created_at")
            .eq("organization_id", orgId)
            .eq("type", "lead_received")
            .eq("source", "site")
            .order("created_at", { ascending: false })
            .limit(5000)

        const ownerLatestLeadByContactId = new Map<string, string>()
        for (const event of (siteLeadEventsResult.data || []) as Array<{ contact_id: string | null; created_at: string | null }>) {
            if (!event.contact_id || !event.created_at || ownerLatestLeadByContactId.has(event.contact_id)) continue
            ownerLatestLeadByContactId.set(event.contact_id, event.created_at)
        }

        if (ownerLatestLeadByContactId.size > 0) {
            const ownerLeadIds = Array.from(ownerLatestLeadByContactId.keys())
            const [ownerContactsResult, ownerInteractionsResult, ownerProfilesResult] = await Promise.all([
                supabase
                    .from("contacts")
                    .select("id, status, assigned_to")
                    .eq("organization_id", orgId)
                    .in("id", ownerLeadIds),
                supabase
                    .from("contact_interactions")
                    .select("contact_id, happened_at")
                    .in("contact_id", ownerLeadIds)
                    .order("happened_at", { ascending: false })
                    .limit(Math.max(ownerLeadIds.length * 8, 50)),
                supabase
                    .from("profiles")
                    .select("id, full_name")
                    .eq("organization_id", orgId),
            ])

            const latestInteractionByContactId = new Map<string, string>()
            for (const row of ownerInteractionsResult.data || []) {
                if (!row.contact_id || latestInteractionByContactId.has(row.contact_id)) continue
                latestInteractionByContactId.set(row.contact_id, row.happened_at)
            }

            const profileNameById = new Map<string, string>()
            for (const row of ownerProfilesResult.data || []) {
                if (row.full_name?.trim()) profileNameById.set(row.id, row.full_name.trim())
            }

            const loadByResponsible = new Map<string, OwnerAttendanceLoad>()

            for (const contact of ownerContactsResult.data || []) {
                const status = contact.status ?? "new"
                const latestLeadAt = ownerLatestLeadByContactId.get(contact.id)
                if (!latestLeadAt) continue

                if (status === "new") ownerNewSiteLeadCount += 1
                if (!contact.assigned_to && status !== "won" && status !== "lost") ownerUnassignedLeadCount += 1

                const latestInteractionAt = latestInteractionByContactId.get(contact.id) ?? null
                const slaLabel = getDashboardSlaLabel(latestLeadAt, status, leadDistributionSettings, nowMs)
                const interactionBeforeLead =
                    !latestInteractionAt || new Date(latestInteractionAt).getTime() < new Date(latestLeadAt).getTime()
                const isOverdue =
                    status !== "won" &&
                    status !== "lost" &&
                    (interactionBeforeLead || slaLabel === "Atrasado")

                if (!isOverdue) continue

                ownerOverdueLeadCount += 1
                const responsibleId = contact.assigned_to || "unassigned"
                const responsibleName = contact.assigned_to
                    ? profileNameById.get(contact.assigned_to) || "Responsável sem nome"
                    : "Sem responsável"
                const load = loadByResponsible.get(responsibleId) || {
                    id: responsibleId,
                    name: responsibleName,
                    overdueCount: 0,
                    newCount: 0,
                }
                load.overdueCount += 1
                if (status === "new") load.newCount += 1
                loadByResponsible.set(responsibleId, load)
            }

            ownerAttendanceLoads = Array.from(loadByResponsible.values())
                .sort((a, b) => {
                    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount
                    return a.name.localeCompare(b.name, "pt-BR")
                })
                .slice(0, 4)
        }
    }

    if (isBroker && user?.id && brokerLatestLeadByContactId.size > 0) {
        const brokerLeadIds = Array.from(brokerLatestLeadByContactId.keys())
        const [brokerSiteContactsResult, brokerInteractionsResult] = await Promise.all([
            supabase
                .from("contacts")
                .select("id, status, assigned_to")
                .in("id", brokerLeadIds)
                .eq("assigned_to", user.id),
            supabase
                .from("contact_interactions")
                .select("contact_id, happened_at")
                .in("contact_id", brokerLeadIds)
                .order("happened_at", { ascending: false })
                .limit(Math.max(brokerLeadIds.length * 8, 50)),
        ])

        const latestInteractionByContactId = new Map<string, string>()
        for (const row of brokerInteractionsResult.data || []) {
            if (!row.contact_id || latestInteractionByContactId.has(row.contact_id)) continue
            latestInteractionByContactId.set(row.contact_id, row.happened_at)
        }

        for (const contact of brokerSiteContactsResult.data || []) {
            const status = contact.status ?? "new"
            const latestLeadAt = brokerLatestLeadByContactId.get(contact.id)
            if (!latestLeadAt) continue

            if (status === "new") brokerSiteNewLeadsCount += 1
            if (status !== "won" && status !== "lost") brokerPendingLeadCount += 1

            const latestInteractionAt = latestInteractionByContactId.get(contact.id) ?? null
            const slaLabel = getDashboardSlaLabel(latestLeadAt, status, leadDistributionSettings, nowMs)
            const interactionBeforeLead =
                !latestInteractionAt || new Date(latestInteractionAt).getTime() < new Date(latestLeadAt).getTime()

            if (status !== "won" && status !== "lost" && (interactionBeforeLead || slaLabel === "Atrasado")) {
                brokerStaleLeadCount += 1
            }
        }
    }

    const brokerUpcomingAppointments = (brokerAppointmentsResult.data || []).map((item) => {
        const propertyRelation = Array.isArray(item.properties) ? item.properties[0] : item.properties
        const contactRelation = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts

        return {
            id: item.id,
            date: item.date,
            status: item.status,
            propertyTitle: propertyRelation?.title ?? null,
            contactName: contactRelation?.name ?? null,
        }
    }) satisfies BrokerUpcomingAppointment[]

    const brokerVisitsTodayCount = brokerUpcomingAppointments.filter((appointment) => {
        const date = new Date(appointment.date)
        return date >= now && date <= endOfToday
    }).length

    const brokerVisits48hCount = brokerUpcomingAppointments.filter((appointment) => {
        const date = new Date(appointment.date)
        return date > endOfToday && date <= next48h
    }).length

    const todayActions = isBroker ? [
        {
            title: "Meus leads do site",
            description: "Fila nova ou pendente para atendimento",
            emptyDescription: "Sem novos leads do site agora. Vale revisar a fila e manter o atendimento em dia.",
            ctaLabel: "Abrir meus leads do site",
            value: brokerPendingLeadCount,
            href: "/contacts/site",
            icon: Globe,
        },
        {
            title: "Visitas de hoje",
            description: "Compromissos para confirmar ou realizar",
            emptyDescription: "Sem visitas para hoje. Vale organizar a agenda e puxar novas conversas da fila.",
            ctaLabel: "Ver agenda de hoje",
            value: brokerVisitsTodayCount,
            href: "/appointments",
            icon: Calendar,
        },
        {
            title: "Próximas 48h",
            description: "Visitas que já pedem preparação",
            emptyDescription: "Sem visitas nas próximas 48h. Boa janela para avançar leads do site.",
            ctaLabel: "Abrir agenda",
            value: brokerVisits48hCount,
            href: "/appointments",
            icon: Building,
        },
        {
            title: "Sem ação recente",
            description: "Leads do site ainda sem retorno claro",
            emptyDescription: "Nenhum lead do site está atrasado agora.",
            ctaLabel: "Revisar fila",
            value: brokerStaleLeadCount,
            href: "/contacts/site",
            icon: Users,
        },
    ] : [
        {
            title: "Sem primeiro atendimento",
            description: "Leads do site que ainda pedem primeira resposta",
            emptyDescription: "Nenhum lead do site está sem primeiro atendimento agora.",
            ctaLabel: "Abrir atendimentos",
            value: ownerNewSiteLeadCount,
            href: "/attendances?status=new",
            icon: Globe,
        },
        {
            title: "Atendimentos atrasados",
            description: "Fila que já pede retomada ou dono claro",
            emptyDescription: "Nenhum atendimento atrasado no momento.",
            ctaLabel: "Ver fila atrasada",
            value: ownerOverdueLeadCount,
            href: "/attendances?priority=critical",
            icon: Users,
        },
        {
            title: "Visitas hoje e próximas",
            description: "Compromissos operacionais da equipe",
            emptyDescription: "Sem visitas próximas na agenda agora.",
            ctaLabel: "Abrir agenda",
            value: upcomingAppointments,
            href: "/appointments",
            icon: Calendar,
        },
        {
            title: "Carteira com pendências",
            description: "Imóveis que ainda travam publicação e divulgação",
            emptyDescription: "Nenhum imóvel está travando a publicação agora.",
            ctaLabel: "Revisar carteira",
            value: propertyVitrineCounts.blocked,
            href: "/properties?siteReadiness=blocked",
            icon: Building,
        },
        {
            title: "Responsáveis com gargalo",
            description: "Corretores com fila atrasada ou sem dono claro",
            emptyDescription: "Sem gargalos por responsável neste momento.",
            ctaLabel: "Ver gargalos",
            value: ownerAttendanceLoads.length + (ownerUnassignedLeadCount > 0 ? 1 : 0),
            href: "/attendances?priority=critical",
            icon: Target,
        },
    ]

    const hasUrgentWorkToday = todayActions.some((action) => action.value > 0)
    const dashboardIntro = isBroker
        ? hasUrgentWorkToday
            ? "Comece pela fila do site, confirme visitas e registre o próximo passo de cada lead."
            : "Seu dia está limpo agora. Revise meus leads do site e prepare a próxima visita."
        : hasUrgentWorkToday
            ? "Priorize atendimentos atrasados, visitas e carteira antes de olhar setup ou integrações."
            : "Sem urgências agora. Revise a carteira publicável e acompanhe a geração de leads do site."

    const propertiesByStatus = Object.entries(propertyStatusCounts).map(([name, value]) => ({
        name: name === 'available' ? 'Disponível' : name === 'sold' ? 'Vendido' : name === 'rented' ? 'Alugado' : name,
        value
    }))

    const contactTypeCounts = (contactsAll.data || []).reduce((acc, curr) => {
        const type = curr.type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const salesFunnelCounts = (contactsDealStages.data || []).reduce((acc, curr) => {
        if (curr.type !== 'lead' && curr.type !== 'client') return acc

        const stage = DEAL_STAGES.includes((curr.deal_stage ?? 'lead') as DealStage)
            ? (curr.deal_stage ?? 'lead') as DealStage
            : 'lead'
        acc[stage] = (acc[stage] || 0) + 1
        return acc
    }, {} as Partial<Record<DealStage, number>>)

    const salesFunnelStages = DEAL_STAGES.map((stage) => ({
        stage,
        count: salesFunnelCounts[stage] ?? 0,
    }))

    const leadsByType = Object.entries(contactTypeCounts).map(([name, value]) => ({
        name: name === 'lead' ? 'Lead' : name === 'client' ? 'Cliente' : name === 'owner' ? 'Proprietário' : name === 'partner' ? 'Parceiro' : name,
        value
    }))

    return (
        <div className="flex flex-col gap-4 lg:gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">{dashboardIntro}</p>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-base">O que fazer hoje</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                    {todayActions.map((action) => {
                        const Icon = action.icon
                        return (
                            <Link
                                key={action.title}
                                href={action.href}
                                className="group rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 sm:p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <Icon className="mt-1 h-4 w-4 text-muted-foreground" />
                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                                <div className="mt-3 text-xl font-semibold sm:text-2xl">{action.value}</div>
                                <div className="mt-1 text-sm font-medium leading-tight">{action.title}</div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    {action.value > 0 ? action.description : action.emptyDescription}
                                </p>
                                <div className="mt-3 text-xs font-medium text-primary">{action.ctaLabel}</div>
                            </Link>
                        )
                    })}
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Link href={isBroker ? "/contacts/site" : "/properties?status=available"} className="group">
                    <Card className="transition-shadow group-hover:shadow-md group-hover:border-primary/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{isBroker ? "Meus leads do site" : "Imóveis Disponíveis"}</CardTitle>
                            {isBroker ? <Globe className="h-4 w-4 text-muted-foreground" /> : <Building className="h-4 w-4 text-muted-foreground" />}
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-xl font-bold sm:text-2xl">{isBroker ? brokerPendingLeadCount : activeProperties}</div>
                            <p className="text-xs text-muted-foreground">
                                {isBroker ? "Fila aberta para atendimento" : "Ativos na carteira"}
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isBroker ? "Leads novos" : "Leads sem responsável"}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold sm:text-2xl">{isBroker ? brokerSiteNewLeadsCount : ownerUnassignedLeadCount}</div>
                        <p className="text-xs text-muted-foreground">
                            {isBroker ? "Entradas que ainda pedem primeira resposta" : "Precisam de dono claro para entrar na rotina"}
                        </p>
                    </CardContent>
                </Card>
                <Link href="/appointments" className="group">
                    <Card className="transition-shadow group-hover:shadow-md group-hover:border-primary/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isBroker ? "Visitas de hoje" : "Visitas próximas"}</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="text-xl font-bold sm:text-2xl">{isBroker ? brokerVisitsTodayCount : upcomingAppointments}</div>
                            <p className="text-xs text-muted-foreground">
                                {isBroker ? "Compromissos que precisam de execução hoje" : "Próximos compromissos"}
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isBroker ? "Sem ação recente" : "Prontos para publicar"}</CardTitle>
                        {isBroker ? <Target className="h-4 w-4 text-muted-foreground" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold sm:text-2xl">{isBroker ? brokerStaleLeadCount : propertyVitrineCounts.ready}</div>
                        <p className="text-xs text-muted-foreground">
                            {isBroker ? "Leads do site que pedem retomada" : "Podem subir para o site sem correção extra"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {isAdmin && ownerAttendanceLoads.length > 0 ? (
                <Card id="responsaveis-com-gargalo">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Responsáveis com gargalo agora</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {ownerAttendanceLoads.map((load) => (
                            <Link
                                key={load.id}
                                href={load.id === "unassigned" ? "/attendances?priority=critical" : `/attendances?priority=critical&assignee=${load.id}`}
                                className="rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                            >
                                <div className="text-sm font-medium">{load.name}</div>
                                <div className="mt-2 text-2xl font-semibold">{load.overdueCount}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {load.newCount > 0
                                        ? `${load.newCount} lead(s) ainda sem primeiro contato`
                                        : "Fila atrasada pedindo retomada"}
                                </div>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            ) : null}

            {isAdmin && aiLeadMetricsResult?.schemaAvailable ? (
                <div className="space-y-2">
                    <div>
                        <h2 className="text-sm font-semibold">Operação de Leads IA</h2>
                        <p className="text-sm text-muted-foreground">
                            Snapshot executivo do pré-atendimento IA no dia de hoje.
                        </p>
                    </div>
                    <AiLeadsMetrics metrics={aiLeadMetricsResult.metrics} />
                </div>
            ) : null}

            {isAdmin && attributionMetrics ? (
                <LeadAttributionCard metrics={attributionMetrics} />
            ) : null}

            {isAdmin && operationalFunnelMetrics ? (
                <OperationalFunnelCard metrics={operationalFunnelMetrics} />
            ) : null}

            {isBroker ? (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Minha fila de atendimentos</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="text-xs text-muted-foreground">Novos</div>
                                <div className="mt-1 text-2xl font-semibold">{brokerSiteNewLeadsCount}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Entraram e ainda pedem primeira resposta.</div>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="text-xs text-muted-foreground">Pendentes</div>
                                <div className="mt-1 text-2xl font-semibold">{brokerPendingLeadCount}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Fila aberta para seguir atendendo.</div>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="text-xs text-muted-foreground">Sem ação recente</div>
                                <div className="mt-1 text-2xl font-semibold">{brokerStaleLeadCount}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Vale abrir a ficha e registrar o próximo passo.</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Próximas visitas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {brokerUpcomingAppointments.length > 0 ? (
                                brokerUpcomingAppointments.slice(0, 4).map((appointment) => {
                                    const date = new Date(appointment.date)
                                    const isToday = date >= now && date <= endOfToday
                                    const isNext48 = !isToday && date <= next48h

                                    return (
                                        <Link
                                            key={appointment.id}
                                            href="/appointments"
                                            className="flex min-w-0 items-start justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/40"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium">
                                                    {appointment.propertyTitle || "Visita sem imóvel"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {appointment.contactName || "Contato sem nome"}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <span className="text-xs font-medium">
                                                    {new Intl.DateTimeFormat("pt-BR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }).format(date)}
                                                </span>
                                                <Badge variant={isToday ? "default" : isNext48 ? "secondary" : "outline"}>
                                                    {isToday ? "Hoje" : isNext48 ? "48h" : "Próxima"}
                                                </Badge>
                                            </div>
                                        </Link>
                                    )
                                })
                            ) : (
                                <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
                                    Ainda sem visitas agendadas. Use a fila de leads do site para puxar as próximas visitas.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {!isBroker ? (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Carteira publicável</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {propertyHealthRows.map((item) => (
                        <Link
                            key={item.status}
                            href={item.href}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 transition-colors hover:bg-muted/40"
                        >
                            <span className="text-sm">{item.label}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${item.badgeClassName}`}>
                                {item.count}
                            </span>
                        </Link>
                    ))}
                </CardContent>
            </Card>
            ) : null}

            {goalsSnapshot?.ok ? (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suas Metas ({goalsSnapshot.period_type === "monthly" ? "mensal" : "semanal"})</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!goalsSnapshot.enabled ? (
                            <p className="text-sm text-muted-foreground">
                                Metas desativadas para seu perfil. Peça a um gestor para ativar em Configurações &gt; Metas.
                            </p>
                        ) : (
                            <>
                                {goalsSnapshot.metric_captacoes_enabled !== false ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Captações</span>
                                            <span className="font-medium">
                                                {goalsSnapshot.current_captacoes ?? 0}/{goalsSnapshot.target_captacoes ?? 0}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{ width: `${Math.max(0, Math.min(100, goalsSnapshot.progress_captacoes_pct ?? 0))}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                {goalsSnapshot.metric_respostas_enabled !== false ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Respostas rápidas</span>
                                            <span className="font-medium">
                                                {goalsSnapshot.current_respostas ?? 0}/{goalsSnapshot.target_respostas ?? 0}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-emerald-500 transition-all"
                                                style={{ width: `${Math.max(0, Math.min(100, goalsSnapshot.progress_respostas_pct ?? 0))}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            SLA da resposta rápida: {goalsSnapshot.response_sla_minutes ?? 15} min.
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
                                                style={{ width: `${Math.max(0, Math.min(100, goalsSnapshot.progress_visitas_pct ?? 0))}%` }}
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

            {isAdmin ? (
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
            ) : null}

            {isAdmin ? (
                <WhatsAppOnboardingChecklist
                    snapshot={whatsappOnboarding}
                    initialCollapsed={whatsappOnboardingCollapsed}
                />
            ) : null}

            {!isBroker ? (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Funil Comercial</CardTitle>
                </CardHeader>
                <CardContent>
                    <SalesFunnel stages={salesFunnelStages} />
                </CardContent>
            </Card>
            ) : null}
            {!isBroker ? <DashboardCharts propertiesByStatus={propertiesByStatus} leadsByType={leadsByType} /> : null}
        </div>
    )
}
