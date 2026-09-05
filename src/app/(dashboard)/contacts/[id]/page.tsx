import { ContactForm } from "@/components/contacts/contact-form"
import { ContactActivityPanel } from "@/components/contacts/contact-activity-panel"
import { ContactAiPanel } from "@/components/contacts/contact-ai-panel"
import { ContactWhatsAppActions } from "@/components/contacts/contact-whatsapp-actions"
import { ContactRecordSummary } from "@/components/contacts/contact-record-summary"
import { OpportunityCreateForm } from "@/components/contacts/opportunity-create-form"
import { ContactProposals } from "@/components/contacts/contact-proposals"
import { InterestProfileForm } from "@/components/contacts/interest-profile-form"
import { PropertyMatchSheet } from "@/components/contacts/property-match-sheet"
import { ContactFollowupPanel } from "@/components/followups/contact-followup-panel"
import { ManualFollowupPanel } from "@/components/followups/manual-followup-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import {
    buildLeadPropertyContext,
    collectLeadPropertyIds,
    extractLeadPropertyReference,
    type LeadPropertyContext,
    type PropertyLookupRecord,
} from "@/lib/contacts/lead-property-context"
import { loadLeadPropertyLookupById } from "@/lib/contacts/lead-property-lookup"
import {
    buildBrokerWhatsAppMessage,
    buildExternalWhatsAppTraceSummary,
} from "@/lib/whatsapp-context"
import {
    canCreateProposalForContact,
    canEditContactDealStage,
    isAdmin,
    type Appointment,
    type DealContract,
    type DealProposal,
    type InterestProfile,
} from "@/lib/types"
import { buildWhatsAppUrl } from "@/lib/whatsapp"
import { notFound } from "next/navigation"
import Link from "next/link"
import { CalendarDays } from "lucide-react"

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

    const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()

    if (contactError) {
        console.error("Error fetching contact:", contactError)
        throw new Error(`Não foi possível carregar o contato: ${contactError.message ?? "erro desconhecido"}`)
    }

    if (!contact) {
        notFound()
    }

    const role = (profile?.role as string | null) ?? null
    const canManageFollowup = role === "owner" || role === "manager"
    const canSendOfficial = role === "owner" || role === "manager"
    const canCreateProposal = canCreateProposalForContact(role, user?.id ?? null, contact.assigned_to)
    const canEditDealStage = canEditContactDealStage(role, user?.id ?? null, contact.assigned_to)
    const assignedProfileName =
        contact.assigned_to
            ? (
                await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", contact.assigned_to)
                    .maybeSingle()
            ).data?.full_name ?? null
            : null

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
    let recentInteractions: Array<{
        id: string
        type: "call" | "email" | "visit" | "note" | "whatsapp"
        direction: "inbound" | "outbound" | null
        summary: string
        happened_at: string
        profiles: { full_name: string | null } | null
    }> = []

    let linkedPropertiesCount = 0
    let appointments: Array<Pick<Appointment, "id" | "starts_at" | "status"> & { date: string, properties?: { title: string | null } | null }> = []
    let proposals: DealProposal[] = []
    let proposalContracts: Record<string, DealContract> = {}
    let leadDistributionSettings = {
        sla_minutes: 15,
        enabled: true,
    }
    const loadAiLeadSnapshot = async () => {
        const sessionResult = await supabase
            .from("ai_lead_sessions")
            .select(
                "id, status, source, current_step, started_at, last_message_at, qualified_at, handoff_requested_at, handoff_completed_at, paused_at, assigned_to_at_handoff"
            )
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (sessionResult.error) {
            const errorMessage =
                `${sessionResult.error.code ?? ""} ${sessionResult.error.message ?? ""} ${sessionResult.error.details ?? ""} ${sessionResult.error.hint ?? ""}`.trim()
            const isMissingAiSchema = /ai_lead_sessions|ai_lead_messages|ai_lead_qualifications|PGRST205|42P01|42703/i.test(
                errorMessage
            )

            if (!isMissingAiSchema) {
                console.error("Error loading ai lead session snapshot:", sessionResult.error)
            }

            return {
                session: null,
                qualification: null,
                messages: [] as Array<{
                    id: string
                    direction: "inbound" | "outbound"
                    author: string
                    content: string
                    created_at: string
                }>,
                handoffProfileName: null as string | null,
            }
        }

        if (!sessionResult.data) {
            return {
                session: null,
                qualification: null,
                messages: [] as Array<{
                    id: string
                    direction: "inbound" | "outbound"
                    author: string
                    content: string
                    created_at: string
                }>,
                handoffProfileName: null as string | null,
            }
        }

        const [qualificationResult, aiMessagesResult] = await Promise.all([
            supabase
                .from("ai_lead_qualifications")
                .select(
                    "intent, transaction_type, property_type, city, neighborhoods, budget_min, budget_max, timeline, stage_score, summary"
                )
                .eq("session_id", sessionResult.data.id)
                .maybeSingle(),
            supabase
                .from("ai_lead_messages")
                .select("id, direction, author, content, created_at")
                .eq("session_id", sessionResult.data.id)
                .order("created_at", { ascending: false })
                .limit(6),
        ])

        const qualification = !qualificationResult.error && qualificationResult.data ? qualificationResult.data : null
        const messages =
            !aiMessagesResult.error
                ? (((aiMessagesResult.data as Array<{
                      id: string
                      direction: "inbound" | "outbound"
                      author: string
                      content: string
                      created_at: string
                  }> | null) || []).reverse())
                : []

        let handoffProfileName: string | null = null

        if (sessionResult.data.assigned_to_at_handoff) {
            const { data: aiHandoffProfile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", sessionResult.data.assigned_to_at_handoff)
                .maybeSingle()

            handoffProfileName = aiHandoffProfile?.full_name ?? null
        }

        return {
            session: sessionResult.data,
            qualification,
            messages,
            handoffProfileName,
        }
    }

    const [jobsResult, messagesResult, eventsResult, interactionsResult, leadSettingsResult, propertiesResult, appointmentsResult, proposalsResult, manualFollowupsResult] = await Promise.all([
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
            .select("id, event_type, source, payload, created_at")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("contact_interactions")
            .select("id, type, direction, summary, happened_at, profiles!contact_interactions_organization_id_created_by_fkey(full_name)")
            .eq("contact_id", id)
            .order("happened_at", { ascending: false })
            .limit(50),
        supabase
            .from("lead_distribution_settings")
            .select("sla_minutes, enabled")
            .maybeSingle(),
        supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("owner_contact_id", id),
        supabase
            .from("appointments")
            .select("id, starts_at, status, properties(title)")
            .eq("contact_id", id)
            .order("starts_at", { ascending: false })
            .limit(5),
        supabase
            .from("deal_proposals")
            .select("id, organization_id, contact_id, assigned_to, property_id, proposed_value, payment_conditions, valid_until, status, notes, created_at, updated_at, properties(title, public_code)")
            .eq("contact_id", id)
            .order("created_at", { ascending: false }),
        supabase
            .from("contact_followups")
            .select("id, due_at, status, source, step")
            .eq("contact_id", id)
            .is("template_id", null)
            .order("due_at", { ascending: true }),
    ])

    const aiLeadSnapshot = await loadAiLeadSnapshot()

    if (!jobsResult.error) {
        followupJobs = (jobsResult.data as typeof followupJobs) || []
    }

    if (!messagesResult.error) {
        recentMessages = (messagesResult.data as typeof recentMessages) || []
    }

    if (!eventsResult.error) {
        // Canonical boundary: `contact_events.event_type` adapts to the panel's
        // legacy `type` field name.
        recentEvents = (((eventsResult.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
            ...e,
            type: e.event_type ?? null,
        })) as typeof recentEvents) || []
    }

    if (!interactionsResult.error) {
        recentInteractions = (interactionsResult.data as unknown as typeof recentInteractions) || []
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

    if (!appointmentsResult.error) {
        // Canonical boundary: `appointments.starts_at` adapts to the panel's
        // legacy `date` field name.
        appointments =
            (((appointmentsResult.data ?? []) as Array<Record<string, unknown>>).map((a) => ({
                ...a,
                date: (a.starts_at as string | null) ?? "",
            })) as unknown as Array<Pick<Appointment, "id" | "starts_at" | "status"> & { date: string, properties?: { title: string | null } | null }>) || []
    }

    if (!proposalsResult.error) {
        proposals = (proposalsResult.data as unknown as DealProposal[]) || []
    }

    // Canonical pipeline stage: latest opportunity stage for this contact
    // (contacts carry no deal_stage). Display-only; stage edits remain a
    // contract gap (opportunity lifecycle decision).
    const { data: contactOpps } = await supabase
        .from("opportunities")
        .select("id, stage, closed_at")
        .eq("contact_id", id)
        .order("updated_at", { ascending: false })
        .limit(5)
    const contactOppRows = ((contactOpps ?? []) as Array<{ id: string, stage: string | null, closed_at: string | null }>)
    const contactDealStage = contactOppRows[0]?.stage ?? null
    const openOpportunityId = contactOppRows.find((opp) => !opp.closed_at)?.id ?? null

    if (proposals.length > 0) {
        const proposalIds = proposals.map((proposal) => proposal.id)
        const { data: contractsData, error: contractsError } = await supabase
            .from("deal_contracts")
            .select(`
                id,
                organization_id,
                contact_id,
                property_id,
                assigned_to,
                proposal_id,
                contract_type,
                final_value,
                commission_value,
                status,
                start_date,
                end_date,
                document_url,
                created_at,
                updated_at,
                properties:properties!deal_contracts_property_id_fkey(title, public_code),
                contacts:contacts!deal_contracts_contact_id_fkey(name, email, phone)
            `)
            .in("proposal_id", proposalIds)

        if (!contractsError && contractsData) {
            const contractAssignedProfileIds = Array.from(
                new Set(contractsData.map((contract) => contract.assigned_to).filter(Boolean))
            ) as string[]

            let contractProfileMap = new Map<string, { full_name: string | null }>()

            if (contractAssignedProfileIds.length > 0) {
                const { data: contractProfiles, error: contractProfilesError } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", contractAssignedProfileIds)

                if (contractProfilesError) {
                    console.error("Error fetching contact-page contract assignees:", contractProfilesError)
                } else {
                    contractProfileMap = new Map(
                        (contractProfiles || []).map((profileRow) => [
                            profileRow.id,
                            { full_name: profileRow.full_name ?? null },
                        ])
                    )
                }
            }

            proposalContracts = Object.fromEntries(
                contractsData
                    .filter((contract) => contract.proposal_id)
                    .map((contract) => [
                        contract.proposal_id as string,
                        {
                            ...contract,
                            profiles: contract.assigned_to
                                ? contractProfileMap.get(contract.assigned_to) ?? null
                                : null,
                        } as DealContract,
                    ])
            )
        } else if (contractsError) {
            console.error("Error fetching proposal contracts:", contractsError)
        }
    }

    const financingWaHref = contact.phone
        ? buildWhatsAppUrl({
            phone: contact.phone,
            message: contact.name
                ? `Olá ${contact.name}, posso ajudar com opções de financiamento para seu imóvel?`
                : "Posso ajudar com opções de financiamento para seu imóvel?",
          })
        : null

    // Extract siteMeta and latestLeadAt from events
    let siteMeta = null
    let latestLeadAt = null
    let leadPropertyContext: LeadPropertyContext | null = null

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
    }

    const leadPropertyReference = leadEvents
        .map((event) => extractLeadPropertyReference(event.payload))
        .find((reference) => Boolean(reference))
    const leadPropertyId = leadPropertyReference?.id ?? null

    const leadPropertyIds = collectLeadPropertyIds([leadPropertyReference])
    const propertyLookupById: Map<string, PropertyLookupRecord> =
        leadPropertyIds.length > 0
            ? await loadLeadPropertyLookupById(supabase, leadPropertyIds, contact.organization_id)
            : new Map<string, PropertyLookupRecord>()

    if (leadPropertyIds.length > 0) {
        leadPropertyContext = buildLeadPropertyContext(
            leadPropertyReference,
            propertyLookupById
        )
    }

    const leadPropertyLookup = leadPropertyId
        ? propertyLookupById.get(leadPropertyId) ?? null
        : null
    const whatsappPropertyTitle = leadPropertyReference?.title ?? leadPropertyLookup?.title ?? null
    const whatsappPropertyCode = leadPropertyLookup?.public_code ?? null
    const waHref = contact.phone
        ? buildWhatsAppUrl({
            phone: contact.phone,
            message: buildBrokerWhatsAppMessage({
                contactName: contact.name,
                propertyTitle: whatsappPropertyTitle,
                propertyCode: whatsappPropertyCode,
            }),
          })
        : null

    // Process last interaction from merged timeline
    let lastInteraction = null
    const mergedActivity = [
        ...recentMessages.map(m => ({ type: 'message', date: m.created_at, desc: m.body })),
        ...recentEvents.map(e => ({ type: 'event', date: e.created_at, desc: e.type })),
        ...recentInteractions.map(i => ({ type: 'interaction', date: i.happened_at, desc: i.summary }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (mergedActivity.length > 0) {
        const latest = mergedActivity[0]
        lastInteraction = {
            date: latest.date,
            description: latest.type === 'message'
                ? latest.desc
                : latest.type === 'interaction'
                    ? latest.desc
                    : `Evento: ${latest.desc}`,
            isMessage: latest.type === 'message'
        }
    }

    const getAppointmentStatusLabel = (status: string | null | undefined) => {
        switch (status) {
            case "scheduled":
                return "Agendado"
            case "completed":
                return "Realizado"
            case "cancelled":
                return "Cancelado"
            case "no_show":
                return "Não compareceu"
            default:
                return status || "Indefinido"
        }
    }

    const getAppointmentStatusVariant = (status: string | null | undefined) => {
        switch (status) {
            case "completed":
                return "secondary" as const
            case "cancelled":
                return "destructive" as const
            case "no_show":
                return "outline" as const
            default:
                return "default" as const
        }
    }

    const newAppointmentParams = new URLSearchParams({
        contactId: contact.id,
        returnTo: `/contacts/${contact.id}`,
    })
    if (leadPropertyId) {
        newAppointmentParams.set("propertyId", leadPropertyId)
    }
    const newAppointmentHref = `/appointments/new?${newAppointmentParams.toString()}`
    const interestProfileRaw = (contact as Record<string, unknown>).interest_profile
    const interestProfileInitial =
        interestProfileRaw && typeof interestProfileRaw === "object" && !Array.isArray(interestProfileRaw)
            ? (interestProfileRaw as InterestProfile)
            : {}
    const detailNow = new Date()
    const upcomingAppointment = [...appointments]
        .filter(
            (appointment) =>
                appointment.status === "scheduled" &&
                new Date(appointment.date).getTime() >= detailNow.getTime()
        )
        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())[0] ?? null
    const nextActionLabel = upcomingAppointment
        ? `Confirmar visita agendada para ${new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(upcomingAppointment.date))}`
        : contact.status === "new"
            ? contact.phone
                ? "Fazer primeiro contato e registrar atendimento"
                : "Cadastrar telefone ou registrar primeiro contato"
            : contact.status === "contacted"
                ? "Qualificar lead e propor próxima visita"
                : "Registrar o próximo passo do atendimento"

    return (
        <div className="flex flex-col gap-6">
            <ContactRecordSummary
                opportunityId={openOpportunityId}
                name={contact.name || "Sem Nome"}
                type={contact.type}
                status={contact.status}
                dealStage={contactDealStage}
                canEditDealStage={canEditDealStage}
                email={contact.email}
                phone={contact.phone}
                city={contact.city}
                interestCity={contact.city}
                interestType={contact.interest_type}
                interestBedrooms={contact.interest_bedrooms}
                interestPriceMax={contact.interest_price_max}
                siteMeta={siteMeta}
                latestLeadAt={latestLeadAt}
                responsibleName={assignedProfileName}
                leadPropertyContext={leadPropertyContext}
                nextActionLabel={nextActionLabel}
                leadDistributionSettings={leadDistributionSettings}
                linkedPropertiesCount={linkedPropertiesCount}
                lastInteraction={lastInteraction}
            >
                <PropertyMatchSheet
                    contactId={contact.id}
                    organizationId={profile?.organization_id ?? contact.organization_id}
                    contactProfile={{
                        city: contact.city,
                        interest_type: contact.interest_type,
                        interest_bedrooms: contact.interest_bedrooms,
                        interest_price_max: contact.interest_price_max,
                    }}
                />
            </ContactRecordSummary>

            {openOpportunityId ? null : (
                <OpportunityCreateForm
                    contactId={contact.id}
                    propertyId={leadPropertyId}
                    propertyTitle={leadPropertyContext?.title ?? null}
                />
            )}

            <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold">Visitas ligadas ao contato</h2>
                        <p className="text-sm text-muted-foreground">Próximos e últimos agendamentos deste contato.</p>
                    </div>
                    <Button asChild size="sm">
                        <Link href={newAppointmentHref}>
                            <CalendarDays className="mr-2 h-4 w-4" />
                            Agendar visita
                        </Link>
                    </Button>
                </div>

                {appointments.length === 0 ? (
                    <div className="mt-4 rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                        Nenhuma visita ligada a este contato ainda.
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {appointments.map((appointment) => (
                            <div key={appointment.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                    <div className="text-sm font-medium">
                                        {new Intl.DateTimeFormat("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        }).format(new Date(appointment.date))}
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                        {appointment.properties?.title || "Imóvel não informado"}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={getAppointmentStatusVariant(appointment.status)}>
                                        {getAppointmentStatusLabel(appointment.status)}
                                    </Badge>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/appointments/${appointment.id}/edit?returnTo=${encodeURIComponent(`/contacts/${contact.id}`)}`}>
                                            Abrir visita
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ContactProposals
                contactId={contact.id}
                organizationId={profile?.organization_id ?? contact.organization_id}
                assignedTo={contact.assigned_to}
                initialProposals={proposals}
                proposalContracts={proposalContracts}
                currentUserId={user?.id ?? null}
                currentUserRole={role}
                canCreateProposal={canCreateProposal}
            />

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6 items-start">
                {/* Atividade e Histórico - Coluna 1 mais densa */}
                <div className="flex flex-col gap-6 w-full min-w-0">
                    <ContactActivityPanel 
                        contactId={contact.id} 
                        messages={recentMessages} 
                        events={recentEvents} 
                        interactions={recentInteractions}
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
                            phone={contact.phone}
                            defaultMessage={buildBrokerWhatsAppMessage({
                                contactName: contact.name,
                                propertyTitle: whatsappPropertyTitle,
                                propertyCode: whatsappPropertyCode,
                            })}
                            traceSummary={buildExternalWhatsAppTraceSummary({
                                propertyTitle: whatsappPropertyTitle,
                                propertyCode: whatsappPropertyCode,
                            })}
                        />
                    </div>

                    <ContactAiPanel
                        contactId={id}
                        propertyId={leadPropertyId}
                        canManage={isAdmin(role) || (role === "broker" && contact.assigned_to === user?.id)}
                        canRequestHandoff={isAdmin(role)}
                        waHref={waHref}
                        financingWaHref={financingWaHref}
                        session={aiLeadSnapshot.session}
                        qualification={aiLeadSnapshot.qualification}
                        recentMessages={aiLeadSnapshot.messages}
                        handoffProfileName={aiLeadSnapshot.handoffProfileName}
                    />

                    <ContactFollowupPanel contactId={id} canManage={canManageFollowup} jobs={followupJobs} />

                    <ManualFollowupPanel
                        contactId={id}
                        canManage={canManageFollowup}
                        now={new Date().getTime()}
                        followups={((manualFollowupsResult.data ?? []) as Array<{
                            id: string
                            due_at: string
                            status: string
                            source: string | null
                            step: number
                        }>)}
                    />

                    <details className="border rounded-xl bg-card p-4 shadow-sm">
                        <summary className="cursor-pointer text-sm font-semibold">
                            Dados cadastrais e responsável
                        </summary>
                        <div className="mt-4">
                            <ContactForm initialData={contact} />
                        </div>
                    </details>
                </div>
            </div>

            <details className="border rounded-xl bg-card p-4 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold">
                    Perfil de interesse do contato
                </summary>
                <div className="mt-4">
                    <p className="mb-4 text-sm text-muted-foreground">
                        Registre o que este contato está buscando.
                    </p>
                    <InterestProfileForm contactId={contact.id} initial={interestProfileInitial} />
                </div>
            </details>
        </div>
    )
}
