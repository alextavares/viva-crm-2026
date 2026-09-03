'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { saveAppointment } from "@/app/actions/appointments"
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
import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { appointmentSchema, type AppointmentFormValues, type SelectOption } from "@/lib/types"

interface AppointmentFormProps {
    properties: SelectOption[]
    contacts: SelectOption[]
    initialData?: AppointmentFormValues & { id: string }
    defaultValues?: Partial<AppointmentFormValues>
    returnTo?: string | null
}

export function AppointmentForm({ properties, contacts, initialData, defaultValues, returnTo }: AppointmentFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const defaultPropertyId = initialData?.property_id ?? defaultValues?.property_id ?? ""
    const defaultContactId = initialData?.contact_id ?? defaultValues?.contact_id ?? ""
    const defaultDate = initialData
        ? new Date(initialData.date).toISOString().slice(0, 16)
        : defaultValues?.date ?? ""
    const defaultNotes = initialData?.notes ?? defaultValues?.notes ?? ""
    const defaultStatus = initialData?.status ?? defaultValues?.status ?? "scheduled"
    const resolvedDefaultValues = useMemo(
        () =>
            ({
                property_id: defaultPropertyId,
                contact_id: defaultContactId,
                date: defaultDate,
                notes: defaultNotes,
                status: defaultStatus,
            }) satisfies AppointmentFormValues,
        [
            defaultContactId,
            defaultDate,
            defaultNotes,
            defaultPropertyId,
            defaultStatus,
        ]
    )

    const form = useForm({
        resolver: zodResolver(appointmentSchema),
        defaultValues: resolvedDefaultValues,
    })

    useEffect(() => {
        form.reset(resolvedDefaultValues)
    }, [form, resolvedDefaultValues])

    async function onSubmit(data: AppointmentFormValues) {
        setIsLoading(true)
        try {
            const result = await saveAppointment({
                ...data,
                id: initialData?.id,
            })

            if (!result.success) {
                toast.error(result.error || "Erro ao salvar visita. Tente novamente.")
                return
            }

            toast.success(initialData ? "Visita atualizada!" : "Visita agendada com sucesso!")
            router.push(returnTo || '/appointments')
        } catch (error) {
            console.error('Error saving appointment:', error)
            const message = error instanceof Error && error.message
                ? error.message
                : "Erro ao salvar visita. Tente novamente."
            toast.error(message)
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
                                <Select onValueChange={field.onChange} value={field.value}>
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
                                <Select onValueChange={field.onChange} value={field.value}>
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
                                <Select onValueChange={field.onChange} value={field.value}>
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
