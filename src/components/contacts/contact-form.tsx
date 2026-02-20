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
import { contactSchema, type ContactFormValues } from "@/lib/types"

interface ContactFormProps {
    initialData?: {
        id: string
        name: string
        email?: string
        phone?: string
        type: string
        status: string
        notes?: string
    }
}

export function ContactForm({ initialData }: ContactFormProps) {
    const { user, organizationId } = useAuth()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()

    const form = useForm({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: initialData?.name || "",
            email: initialData?.email || "",
            phone: initialData?.phone || "",
            type: initialData?.type || "lead",
            status: initialData?.status || "new",
            notes: initialData?.notes || "",
        },
    })

    async function onSubmit(data: ContactFormValues) {
        if (!user || !organizationId) return

        setIsLoading(true)
        try {
            // Prepare payload (org is already known from AuthProvider profile fetch).
            const payload = {
                ...data,
                organization_id: organizationId,
                assigned_to: user.id, // Assign to creator by default
            }

            let error

            if (initialData?.id) {
                // UPDATE
                const result = await supabase
                    .from('contacts')
                    .update(payload)
                    .eq('id', initialData.id)
                error = result.error
            } else {
                // INSERT
                const result = await supabase
                    .from('contacts')
                    .insert(payload)
                    .select("id, type")
                    .single()
                error = result.error

                if (!error && result.data?.id && (result.data.type || data.type) === "lead") {
                    const { error: followupError } = await supabase.rpc("followup_schedule_sequence", {
                        p_org_id: organizationId,
                        p_contact_id: result.data.id,
                        p_start_at: new Date().toISOString(),
                        p_source: "crm_manual",
                    })

                    if (followupError) {
                        console.error("Error scheduling manual follow-up:", followupError)
                    }
                }
            }

            if (error) throw error

            toast.success(initialData ? "Contato atualizado com sucesso!" : "Contato criado com sucesso!")
            router.push('/contacts')
            router.refresh()
        } catch (error) {
            console.error('Error saving contact:', error)
            toast.error("Erro ao salvar contato. Tente novamente.")
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
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nome Completo</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: João da Silva" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input placeholder="joao@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Telefone / WhatsApp</FormLabel>
                                <FormControl>
                                    <Input placeholder="(11) 99999-9999" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Contato</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="lead">Lead (Interessado)</SelectItem>
                                        <SelectItem value="client">Cliente (Já comprou/alugou)</SelectItem>
                                        <SelectItem value="owner">Proprietário</SelectItem>
                                        <SelectItem value="partner">Parceiro</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                        <SelectItem value="new">Novo</SelectItem>
                                        <SelectItem value="contacted">Contactado</SelectItem>
                                        <SelectItem value="qualified">Qualificado</SelectItem>
                                        <SelectItem value="lost">Perdido</SelectItem>
                                        <SelectItem value="won">Ganho</SelectItem>
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
                                    placeholder="Interesses, histórico, preferências..."
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
                    {initialData ? 'Salvar Alterações' : 'Criar Contato'}
                </Button>
            </form>
        </Form>
    )
}
