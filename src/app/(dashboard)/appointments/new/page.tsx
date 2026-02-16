import { AppointmentForm } from "@/components/appointments/appointment-form"
import { createClient } from "@/lib/supabase/server"

export default async function NewAppointmentPage() {
    const supabase = await createClient()

    // Fetch properties and contacts in parallel
    const [propertiesResult, contactsResult] = await Promise.all([
        supabase.from('properties').select('id, title').eq('status', 'available'),
        supabase.from('contacts').select('id, name').order('name', { ascending: true })
    ])

    const properties = propertiesResult.data?.map(p => ({ id: p.id, label: p.title })) || []
    const contacts = contactsResult.data?.map(c => ({ id: c.id, label: c.name })) || []

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-lg font-semibold md:text-2xl">Agendar Visita</h1>
                <p className="text-muted-foreground">Registre um novo agendamento de visita.</p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/10">
                <AppointmentForm properties={properties} contacts={contacts} />
            </div>
        </div>
    )
}
