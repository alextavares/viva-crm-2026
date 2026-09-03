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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { saveContactRecord } from "@/app/actions/contacts"
import { contactSchema, PROPERTY_TYPE_OPTIONS, type ContactFormValues } from "@/lib/types"

interface ContactFormProps {
    initialData?: {
        id: string
        name: string
        email?: string
        phone?: string
        city?: string | null
        type: string
        status: string
        interest_type?: string | null
        interest_bedrooms?: number | null
        interest_price_max?: number | null
        notes?: string
    }
}

export function ContactForm({ initialData }: ContactFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: initialData?.name || "",
            email: initialData?.email || "",
            phone: initialData?.phone || "",
            city: initialData?.city || "",
            type: initialData?.type || "lead",
            status: initialData?.status || "new",
            interest_type: (initialData?.interest_type || "") as ContactFormValues["interest_type"],
            interest_bedrooms: initialData?.interest_bedrooms ?? null,
            interest_price_max: initialData?.interest_price_max ?? null,
            notes: initialData?.notes || "",
        },
    })

    async function onSubmit(data: ContactFormValues) {
        setIsLoading(true)
        setSubmitError(null)

        try {
            const result = await saveContactRecord({
                id: initialData?.id,
                values: data,
            })

            if (!result.success) {
                setSubmitError(result.error)
                toast.error(result.error)
                return
            }

            setSubmitError(null)
            toast.success(initialData ? "Contato atualizado com sucesso!" : "Contato criado com sucesso!")
            router.push('/contacts')
            router.refresh()
        } catch (error) {
            console.error('Error saving contact:', error)
            const message =
                typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof (error as { message?: unknown }).message === "string"
                    ? (error as { message: string }).message
                    : "Erro ao salvar contato. Tente novamente."
            const errorMessage = message.startsWith("Erro ao")
                ? message
                : `Erro ao salvar contato: ${message}`
            setSubmitError(errorMessage)
            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Dados básicos</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                            name="city"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cidade</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: São Sebastião" {...field} />
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
                                            <SelectItem value="contacted">Em atendimento</SelectItem>
                                            <SelectItem value="qualified">Qualificado</SelectItem>
                                            <SelectItem value="lost">Perdido</SelectItem>
                                            <SelectItem value="won">Ganho</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Perfil de interesse</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="interest_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de imóvel</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value === "any" ? "" : value)}
                                        defaultValue={field.value || "any"}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Qualquer tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="any">Qualquer tipo</SelectItem>
                                            {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                                                <SelectItem key={propertyType.value} value={propertyType.value}>
                                                    {propertyType.label}
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
                            name="interest_bedrooms"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quartos desejados</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="Ex: 3"
                                            value={field.value ?? ""}
                                            onChange={(e) =>
                                                field.onChange(e.target.value === "" ? null : Number(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="interest_price_max"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço máximo</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="1"
                                            placeholder="Ex: 1200000"
                                            value={field.value ?? ""}
                                            onChange={(e) =>
                                                field.onChange(e.target.value === "" ? null : Number(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

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

                {submitError ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {submitError}
                    </div>
                ) : null}

                <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? 'Salvar Alterações' : 'Criar Contato'}
                </Button>
            </form>
        </Form>
    )
}
