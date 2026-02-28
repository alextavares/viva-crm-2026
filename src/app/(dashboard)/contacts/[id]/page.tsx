import { ContactForm } from "@/components/contacts/contact-form"
import { ContactActivityPanel } from "@/components/contacts/contact-activity-panel"
import { ContactWhatsAppActions } from "@/components/contacts/contact-whatsapp-actions"
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

    const [jobsResult, messagesResult, eventsResult] = await Promise.all([
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
            .limit(10),
        supabase
            .from("contact_events")
            .select("id, type, source, payload, created_at")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(10),
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

    const waHref = contact.phone
        ? buildWhatsAppUrl({
            phone: contact.phone,
            message: contact.name ? `Olá ${contact.name}, tudo bem?` : "Olá, tudo bem?",
          })
        : null

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold md:text-2xl">Editar Contato</h1>
                    <p className="text-muted-foreground">Atualize as informações do contato.</p>
                </div>
                <ContactWhatsAppActions
                    contactId={id}
                    canSendOfficial={canSendOfficial}
                    waHref={waHref}
                    defaultMessage={contact.name ? `Olá ${contact.name}, tudo bem?` : "Olá, tudo bem?"}
                />
            </div>

            <div className="border rounded-lg p-4 bg-muted/10">
                <ContactForm initialData={contact} />
            </div>

            <ContactActivityPanel messages={recentMessages} events={recentEvents} />

            <ContactFollowupPanel contactId={id} canManage={canManageFollowup} jobs={followupJobs} />
        </div>
    )
}
