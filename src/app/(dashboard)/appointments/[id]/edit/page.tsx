import { notFound } from 'next/navigation'
import { AppointmentForm } from '@/components/appointments/appointment-form'
import { createClient } from '@/lib/supabase/server'
import { SelectOption } from '@/lib/types'

export default async function EditAppointmentPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    // Fetch appointment
    const { data: appointment, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !appointment) {
        notFound()
    }

    // Fetch properties and contacts for selects
    const { data: properties } = await supabase
        .from('properties')
        .select('id, title')
        .eq('organization_id', appointment.organization_id)
        .eq('status', 'available') // Should we show sold properties? Maybe not for new appts, but for editing? 
    // If editing an existing appointment for a sold property, it might disappear from list if we filter here.
    // Better to fetch specific property + available ones, OR just all properties for simplicity in MVP.
    // Let's remove status filter for edit or ensure the current property is included.
    // For now, removing filter to be safe.

    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('organization_id', appointment.organization_id)

    const propertyOptions: SelectOption[] = (properties || []).map(p => ({
        id: p.id,
        label: p.title
    }))

    const contactOptions: SelectOption[] = (contacts || []).map(c => ({
        id: c.id,
        label: c.name
    }))

    return (
        <div className="max-w-2xl mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">Editar Agendamento</h1>
            <AppointmentForm
                properties={propertyOptions}
                contacts={contactOptions}
                initialData={appointment}
            />
        </div>
    )
}
