import { AppointmentForm } from "@/components/appointments/appointment-form"
import {
    buildAppointmentDefaultValues,
    buildAppointmentPropertyLabel,
    mergeAppointmentPropertyOptions,
} from "@/lib/appointments/appointment-defaults"
import { extractLeadPropertyReference } from "@/lib/contacts/lead-property-context"
import { loadLeadPropertyLookupById } from "@/lib/contacts/lead-property-lookup"
import { createClient } from "@/lib/supabase/server"

export default async function NewAppointmentPage({
    searchParams,
}: {
    searchParams?: Promise<{ contactId?: string; propertyId?: string; returnTo?: string }>
}) {
    const supabase = await createClient()
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const preselectedContactId = resolvedSearchParams?.contactId || null
    const propertyIdFromUrl = resolvedSearchParams?.propertyId || null
    const returnTo = resolvedSearchParams?.returnTo || null

    let resolvedPropertyId = propertyIdFromUrl

    if (!resolvedPropertyId && preselectedContactId) {
        const { data: leadEvents, error: leadEventsError } = await supabase
            .from("contact_events")
            .select("payload")
            .eq("contact_id", preselectedContactId)
            .eq("type", "lead_received")
            .order("created_at", { ascending: false })
            .limit(10)

        if (leadEventsError) {
            console.error("Error resolving appointment property from contact:", leadEventsError)
        } else {
            const leadPropertyReference = (leadEvents || [])
                .map((event) => extractLeadPropertyReference(event.payload as Record<string, unknown> | null))
                .find((reference) => Boolean(reference))

            resolvedPropertyId = leadPropertyReference?.id ?? null
        }
    }

    const [propertiesResult, contactsResult] = await Promise.all([
        supabase.from('properties').select('id, title, public_code').eq('status', 'available'),
        supabase.from('contacts').select('id, name').order('name', { ascending: true }),
    ])

    const baseProperties = propertiesResult.data?.map(p => ({
        id: p.id,
        label: buildAppointmentPropertyLabel(p),
    })) || []
    const preselectedPropertyLookup =
        resolvedPropertyId
            ? await loadLeadPropertyLookupById(supabase, [resolvedPropertyId])
            : new Map()
    const preselectedProperty = resolvedPropertyId
        ? preselectedPropertyLookup.get(resolvedPropertyId) ?? null
        : null
    const properties = mergeAppointmentPropertyOptions(baseProperties, preselectedProperty)
    const contacts = contactsResult.data?.map(c => ({ id: c.id, label: c.name })) || []
    const defaultValues = buildAppointmentDefaultValues({
        contactId: preselectedContactId,
        propertyId: resolvedPropertyId,
    })

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-lg font-semibold md:text-2xl">Agendar Visita</h1>
                <p className="text-muted-foreground">Registre um novo agendamento de visita.</p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/10">
                <AppointmentForm
                    properties={properties}
                    contacts={contacts}
                    defaultValues={defaultValues}
                    returnTo={returnTo}
                />
            </div>
        </div>
    )
}
