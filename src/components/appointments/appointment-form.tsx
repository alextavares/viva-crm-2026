'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { appointmentSchema, type AppointmentFormValues, type SelectOption } from "@/lib/types"

interface AppointmentFormProps {
    properties: SelectOption[]
    contacts: SelectOption[]
    initialData?: AppointmentFormValues & { id: string }
}

export function AppointmentForm({ properties, contacts, initialData }: AppointmentFormProps) {
    const { user } = useAuth()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()

    const form = useForm({
        resolver: zodResolver(appointmentSchema),
        defaultValues: initialData ? {
            property_id: initialData.property_id,
            contact_id: initialData.contact_id,
            date: new Date(initialData.date).toISOString().slice(0, 16), // datetime-local format
            notes: initialData.notes || "",
            status: initialData.status,
        } : {
            property_id: "",
            contact_id: "",
            date: "",
            notes: "",
            status: "scheduled",
        },
    })

    async function onSubmit(data: AppointmentFormValues) {
        if (!user) return

        setIsLoading(true)
        try {
            // 1. Get organization_id from profile (only needed for create, but safe to fetch)
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single()

            if (!profile?.organization_id) throw new Error("Organization not found")

            // 2. Prepare payload
            const payload = {
                organization_id: profile.organization_id, // Keep org_id consistent
                // broker_id: user.id, // Don't change broker on edit unless intended? RLS handles logic. 
                // For edit, we might strictly check RLS. 
                // Let's assume user editing is the broker or manager.
                // If creating, set broker_id.
                ...(initialData ? {} : { broker_id: user.id }),
                property_id: data.property_id,
                contact_id: data.contact_id,
                date: new Date(data.date).toISOString(),
                status: data.status,
                notes: data.notes,
            }

            let error;
            if (initialData) {
                const { error: updateError } = await supabase
                    .from('appointments')
                    .update(payload)
                    .eq('id', initialData.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('appointments')
                    .insert(payload)
                error = insertError
            }

            if (error) throw error

            toast.success(initialData ? "Visita atualizada!" : "Visita agendada com sucesso!")
            router.push('/appointments')
            router.refresh()
        } catch (error) {
            console.error('Error saving appointment:', error)
            toast.error("Erro ao salvar visita. Tente novamente.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="property_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Imóvel</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um imóvel" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {properties.map((prop) => (
                                            <SelectItem key={prop.id} value={prop.id}>
                                                {prop.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="contact_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Contato (Cliente/Lead)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um contato" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {contacts.map((contact) => (
                                            <SelectItem key={contact.id} value={contact.id}>
                                                {contact.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data e Hora</FormLabel>
                                <FormControl>
                                    <Input type="datetime-local" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Agendado</SelectItem>
                                        <SelectItem value="completed">Realizado</SelectItem>
                                        <SelectItem value="cancelled">Cancelado</SelectItem>
                                        <SelectItem value="no_show">Não Compareceu</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Observações</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Instruções de acesso, preferências do cliente..."
                                    className="min-h-[100px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? "Salvar Alterações" : "Agendar Visita"}
                </Button>
            </form>
        </Form>
    )
}
