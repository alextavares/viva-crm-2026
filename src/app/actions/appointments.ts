'use server'

import { createClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/email'

export async function updateAppointmentStatusAction(appointmentId: string, status: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Não autenticado")

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    if (!profile?.organization_id) throw new Error("Sem permissão")

    // 1. Update DB — scoped to same organization
    const { error: updateError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)
        .eq('organization_id', profile.organization_id)

    if (updateError) {
        throw new Error(updateError.message)
    }

    // 2. Send transaction email if 'scheduled' (which means confirmed in our context)
    if (status === 'scheduled') {
        const { data: appointment } = await supabase
            .from('appointments')
            .select(`
                *,
                contacts ( name, email ),
                properties ( title, address )
            `)
            .eq('id', appointmentId)
            .single()

        if (appointment && appointment.contacts?.email) {
            const propertyTitle = appointment.properties?.title || 'nosso imóvel'
            let addressText = 'Endereço a confirmar'

            if (appointment.properties?.address) {
                const addressObj = appointment.properties.address as Record<string, unknown>
                addressText = (typeof addressObj.full_address === 'string' ? addressObj.full_address : null) || addressText
            }

            const dateStr = new Date(appointment.date).toLocaleString('pt-BR', {
                dateStyle: 'full',
                timeStyle: 'short'
            })

            await sendTransactionalEmail({
                to: appointment.contacts.email,
                subject: `Visita Agendada: ${propertyTitle}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.5;">
                        <h2 style="color: #2563eb;">Sua visita foi agendada!</h2>
                        <p>Olá <strong>${appointment.contacts.name}</strong>,</p>
                        <p>Confirmamos a sua visita para <strong>${propertyTitle}</strong>.</p>
                        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
                            <p style="margin: 0 0 8px 0;"><strong>Data e Hora:</strong><br /> ${dateStr}</p>
                            <p style="margin: 0;"><strong>Endereço:</strong><br /> ${addressText}</p>
                        </div>
                        <p>Caso precise remarcar ou cancelar, por favor entre em contato conosco.</p>
                        <br/>
                        <p style="color: #4b5563; font-size: 14px;">
                            Atenciosamente,<br/>
                            Equipe Imobi CRM
                        </p>
                    </div>
                `
            })
        }
    }
}
