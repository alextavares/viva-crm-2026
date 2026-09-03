'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/email'
import {
    APPOINTMENT_STATUSES,
    appointmentSchema,
    isAdmin,
    type ActionResult,
    type AppointmentFormValues,
} from '@/lib/types'

const saveAppointmentSchema = appointmentSchema.extend({
    id: z.string().optional(),
})

export async function saveAppointment(
    input: AppointmentFormValues & { id?: string }
): Promise<ActionResult<{ id: string }>> {
    try {
        const parsed = saveAppointmentSchema.safeParse(input)
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || 'Dados inválidos. Verifique os campos da visita.',
            }
        }

        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Não autenticado.' }
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: 'Sem permissão para salvar visitas.' }
        }

        const payload = {
            property_id: parsed.data.property_id,
            contact_id: parsed.data.contact_id,
            date: new Date(parsed.data.date).toISOString(),
            status: parsed.data.status,
            notes: parsed.data.notes?.trim() || null,
            updated_at: new Date().toISOString(),
        }

        if (parsed.data.id) {
            const { data: updated, error } = await supabase
                .from('appointments')
                .update(payload)
                .eq('id', parsed.data.id)
                .eq('organization_id', profile.organization_id)
                .select('id')
                .single()

            if (error) {
                return { success: false, error: error.message || 'Não foi possível atualizar a visita.' }
            }

            if (!updated?.id) {
                return { success: false, error: 'Visita não encontrada nesta organização.' }
            }

            revalidatePath('/appointments')
            revalidatePath(`/appointments/${updated.id}/edit`)
            revalidatePath(`/contacts/${parsed.data.contact_id}`)
            return { success: true, data: { id: updated.id } }
        }

        const { data: created, error } = await supabase
            .from('appointments')
            .insert({
                ...payload,
                organization_id: profile.organization_id,
                assigned_to: user.id,
            })
            .select('id')
            .single()

        if (error) {
            return { success: false, error: error.message || 'Não foi possível agendar a visita.' }
        }

        if (!created?.id) {
            return { success: false, error: 'Não foi possível confirmar a criação da visita.' }
        }

        revalidatePath('/appointments')
        revalidatePath(`/contacts/${parsed.data.contact_id}`)
        return { success: true, data: { id: created.id } }
    } catch (error) {
        console.error('Unexpected appointment save error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Não foi possível salvar a visita.',
        }
    }
}

const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES)
const deleteAppointmentSchema = z.object({
    appointmentId: z.string().uuid(),
})

export async function updateAppointmentStatusAction(
    appointmentId: string,
    status: string
): Promise<ActionResult<{ emailSent: boolean }>> {
    try {
        const parsedStatus = appointmentStatusSchema.safeParse(status)
        if (!parsedStatus.success) {
            return { success: false, error: 'Status inválido para a visita.' }
        }

        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Não autenticado.' }
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: 'Sem permissão.' }
        }

        const { error: updateError } = await supabase
            .from('appointments')
            .update({ status: parsedStatus.data })
            .eq('id', appointmentId)
            .eq('organization_id', profile.organization_id)

        if (updateError) {
            return { success: false, error: updateError.message || 'Não foi possível atualizar o status da visita.' }
        }

        let emailSent = true

        if (parsedStatus.data === 'scheduled') {
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
                    addressText =
                        (typeof addressObj.full_address === 'string' ? addressObj.full_address : null) || addressText
                }

                const dateStr = new Date(appointment.date).toLocaleString('pt-BR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                })

                try {
                    const emailHtml = `
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

                    await sendTransactionalEmail({
                        to: appointment.contacts.email,
                        subject: `Visita Agendada: ${propertyTitle}`,
                        html: emailHtml,
                    })
                } catch (emailError) {
                    console.error('Appointment confirmation email error:', emailError)
                    emailSent = false
                }
            }
        }

        return { success: true, data: { emailSent } }
    } catch (error) {
        console.error('Unexpected appointment status update error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Não foi possível atualizar o status da visita.',
        }
    }
}

export async function deleteAppointmentAction(
    appointmentId: string
): Promise<ActionResult<{ deletedId: string }>> {
    try {
        const parsed = deleteAppointmentSchema.safeParse({ appointmentId })
        if (!parsed.success) {
            return { success: false, error: 'Visita inválida para exclusão.' }
        }

        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Não autenticado.' }
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: 'Sem permissão.' }
        }

        if (!isAdmin(profile.role)) {
            return { success: false, error: 'Você não tem permissão para excluir visitas.' }
        }

        const { data: appointment } = await supabase
            .from('appointments')
            .select('id, organization_id')
            .eq('id', parsed.data.appointmentId)
            .single()

        if (!appointment || appointment.organization_id !== profile.organization_id) {
            return { success: false, error: 'Visita não encontrada ou sem acesso.' }
        }

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', parsed.data.appointmentId)
            .eq('organization_id', profile.organization_id)

        if (error) {
            console.error('Error deleting appointment:', error)
            return { success: false, error: error.message || 'Não foi possível excluir a visita.' }
        }

        return { success: true, data: { deletedId: parsed.data.appointmentId } }
    } catch (error) {
        console.error('Unexpected appointment delete action error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Não foi possível excluir a visita.',
        }
    }
}
