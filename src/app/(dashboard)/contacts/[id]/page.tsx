import { ContactForm } from "@/components/contacts/contact-form"
import { ContactActivityPanel } from "@/components/contacts/contact-activity-panel"
import { ContactWhatsAppActions } from "@/components/contacts/contact-whatsapp-actions"
import { ContactRecordSummary } from "@/components/contacts/contact-record-summary"
import { ContactFollowupPanel } from "@/components/followups/contact-followup-panel"
import { createClient } from "@/lib/supabase/server"
import { buildWhatsAppUrl } from "@/lib/whatsapp"
import { notFound } from "next/navigation"

interface PageProps {
    params: Promise<{
        id: string
    }>
}

export default async function ContactEditPage({ params }: PageProps) {
    const { id } = await params
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

    const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()

    if (!contact) {
        notFound()
    }

    const role = (profile?.role as string | null) ?? null
    const canManageFollowup = role === "owner" || role === "manager"
    const canSendOfficial = role === "owner" || role === "manager"

    let followupJobs: Array<{
        id: string
        step: "5m" | "24h" | "3d"
        status: "pending" | "sent" | "failed" | "paused" | "canceled"
        scheduled_at: string
        processed_at: string | null
        error: string | null
    }> = []
    let recentMessages: Array<{
        id: string
        direction: "in" | "out"
        channel: string
        body: string
        created_at: string
    }> = []
    let recentEvents: Array<{
        id: string
        type: string
        source: string
        payload: Record<string, unknown> | null
        created_at: string
    }> = []

    let linkedPropertiesCount = 0
    let leadDistributionSettings = {
        sla_minutes: 15,
        enabled: true,
    }

    const [jobsResult, messagesResult, eventsResult, leadSettingsResult, propertiesResult] = await Promise.all([
        supabase
            .from("followup_jobs")
            .select("id, step, status, scheduled_at, processed_at, error")
            .eq("contact_id", id)
            .order("scheduled_at", { ascending: true }),
        supabase
            .from("messages")
            .select("id, direction, channel, body, created_at")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("contact_events")
            .select("id, type, source, payload, created_at")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("lead_distribution_settings")
            .select("sla_minutes, enabled")
            .maybeSingle(),
        supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("owner_contact_id", id),
    ])

    if (!jobsResult.error) {
        followupJobs = (jobsResult.data as typeof followupJobs) || []
    }

    if (!messagesResult.error) {
        recentMessages = (messagesResult.data as typeof recentMessages) || []
    }

    if (!eventsResult.error) {
        recentEvents = (eventsResult.data as typeof recentEvents) || []
    }

    if (leadSettingsResult.data) {
        leadDistributionSettings = {
            sla_minutes: leadSettingsResult.data.sla_minutes ?? 15,
            enabled: leadSettingsResult.data.enabled ?? true,
        }
    }

    if (propertiesResult.count !== null) {
        linkedPropertiesCount = propertiesResult.count
    }

    const waHref = contact.phone
        ? buildWhatsAppUrl({
            phone: contact.phone,
            message: contact.name ? `Olá ${contact.name}, tudo bem?` : "Olá, tudo bem?",
          })
        : null

    // Extract siteMeta and latestLeadAt from events
    let siteMeta = null
    let latestLeadAt = null
    let leadPropertyContext = null

    const leadEvents = recentEvents.filter((e) => e.type === "lead_received")
    if (leadEvents.length > 0) {
        const lastLead = leadEvents[0] // newest
        latestLeadAt = lastLead.created_at

        const payload = lastLead.payload || {}
        const sourceDomain =
            (typeof payload.source_domain === "string" && payload.source_domain) ||
            (typeof payload.site_slug === "string" && payload.site_slug) ||
            null

        siteMeta = {
            source: lastLead.source,
            domain: sourceDomain,
            lastEventAt: lastLead.created_at,
        }

        if (typeof payload.property_id === "string" && typeof payload.property_title === "string") {
            leadPropertyContext = {
                id: payload.property_id,
                title: payload.property_title,
            }
        }
    }

    // Process last interaction from merged timeline
    let lastInteraction = null
    const mergedActivity = [
        ...recentMessages.map(m => ({ type: 'message', date: m.created_at, desc: m.body })),
        ...recentEvents.map(e => ({ type: 'event', date: e.created_at, desc: e.type }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (mergedActivity.length > 0) {
        const latest = mergedActivity[0]
        lastInteraction = {
            date: latest.date,
            description: latest.type === 'message' ? latest.desc : `Evento: ${latest.desc}`,
            isMessage: latest.type === 'message'
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <ContactRecordSummary
                contactId={contact.id}
                name={contact.name || "Sem Nome"}
                type={contact.type}
                status={contact.status}
                email={contact.email}
                phone={contact.phone}
                city={contact.city}
                siteMeta={siteMeta}
                latestLeadAt={latestLeadAt}
                leadPropertyContext={leadPropertyContext}
                leadDistributionSettings={leadDistributionSettings}
                linkedPropertiesCount={linkedPropertiesCount}
                lastInteraction={lastInteraction}
            />

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6 items-start">
                {/* Atividade e Histórico - Coluna 1 mais densa */}
                <div className="flex flex-col gap-6 w-full min-w-0">
                    <ContactActivityPanel 
                        contactId={contact.id} 
                        organizationId={profile?.organization_id} 
                        messages={recentMessages} 
                        events={recentEvents} 
                    />
                </div>

                {/* Painel lateral: Ações rápidas, Formulário de Detalhes, e SLA - Coluna 2 */}
                <div className="flex flex-col gap-6 w-full min-w-0">
                    <div className="border rounded-xl p-4 bg-muted/20 shadow-sm flex flex-col gap-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                           Ações Rápidas
                        </h2>
                        <ContactWhatsAppActions
                            contactId={id}
                            canSendOfficial={canSendOfficial}
                            waHref={waHref}
                            defaultMessage={contact.name ? `Olá ${contact.name}, tudo bem?` : "Olá, tudo bem?"}
                        />
                    </div>

                    <ContactFollowupPanel contactId={id} canManage={canManageFollowup} jobs={followupJobs} />

                    <div className="border rounded-xl p-4 bg-card shadow-sm">
                        <h2 className="text-sm font-semibold mb-4">Dados Cadastrais</h2>
                        <ContactForm initialData={contact} />
                    </div>
                </div>
            </div>
        </div>
    )
}
