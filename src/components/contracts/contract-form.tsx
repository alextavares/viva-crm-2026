"use client"

import { useState, useEffect, Suspense, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn, displayEmptyForZero, parseNumberInput } from "@/lib/utils"

import { contractSchema, type ContractFormValues, type DealContract } from "@/lib/types"
import { saveContract } from "@/app/actions/contracts"
import { createClient } from "@/lib/supabase/client"

interface ContractFormProps {
    contactId?: string
    organizationId: string
    assignedTo?: string | null
    initialData?: Partial<DealContract>
    onSuccess?: () => void
    onCancel?: () => void
}

type PropertyOption = {
    id: string
    title: string
    price: number | null
}

type ContactOption = {
    id: string
    name: string
}

type ContractFormInput = z.input<typeof contractSchema>

export function ContractForm({
    contactId,
    organizationId,
    assignedTo,
    initialData,
    onSuccess,
    onCancel
}: ContractFormProps) {
    return (
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <ContractFormInner
                contactId={contactId}
                organizationId={organizationId}
                assignedTo={assignedTo}
                initialData={initialData}
                onSuccess={onSuccess}
                onCancel={onCancel}
            />
        </Suspense>
    )
}

function ContractFormInner({
    contactId,
    organizationId,
    assignedTo,
    initialData,
    onSuccess,
    onCancel
}: ContractFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [properties, setProperties] = useState<PropertyOption[]>([])
    const [contacts, setContacts] = useState<ContactOption[]>([])
    const [brokers, setBrokers] = useState<{ id: string, name: string }[]>([])
    const [fetchingDeps, setFetchingDeps] = useState(true)
    const [depsError, setDepsError] = useState<string | null>(null)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const searchParams = useSearchParams()

    // Get pre-population data from URL if not in initialData
    const urlContactId = searchParams.get("contact_id")
    const urlPropertyId = searchParams.get("property_id")
    const urlProposalId = searchParams.get("proposal_id")
    const urlFinalValue = searchParams.get("final_value")
    const urlAssignedTo = searchParams.get("assigned_to")

    const normalizedDefaults = useMemo(
        () => ({
            organization_id: organizationId,
            contact_id: initialData?.contact_id ?? contactId ?? urlContactId ?? "",
            property_id: initialData?.property_id ?? urlPropertyId ?? "",
            assigned_to: initialData?.assigned_to ?? assignedTo ?? urlAssignedTo ?? "",
            proposal_id: initialData?.proposal_id ?? urlProposalId ?? "",
            contract_type: initialData?.contract_type ?? "sale",
            status: initialData?.status ?? "draft",
            final_value: initialData?.final_value ?? (urlFinalValue ? parseFloat(urlFinalValue) : 0),
            commission_value: initialData?.commission_value ?? 0,
            start_date: initialData?.start_date ?? "",
            end_date: initialData?.end_date ?? "",
            document_url: initialData?.document_url ?? "",
        }),
        [organizationId, contactId, assignedTo, initialData, urlContactId, urlPropertyId, urlProposalId, urlFinalValue, urlAssignedTo]
    )

    const form = useForm<ContractFormInput, unknown, ContractFormValues>({
        resolver: zodResolver(contractSchema),
        defaultValues: normalizedDefaults
    })

    useEffect(() => {
        form.reset(normalizedDefaults)
    }, [form, normalizedDefaults])

    useEffect(() => {
        const fetchDependencies = async () => {
            setFetchingDeps(true)
            setDepsError(null)
            try {
                const supabase = createClient()

                const promises = [
                    supabase
                        .from("properties")
                        .select("id, title, price")
                        .eq("organization_id", organizationId)
                        .order("title"),
                    supabase
                        .from("profiles")
                        .select("id, full_name")
                        .eq("organization_id", organizationId)
                        .order("full_name")
                ]

                if (!contactId && !initialData?.contact_id) {
                    promises.push(
                        supabase
                            .from("contacts")
                            .select("id, name")
                            .eq("organization_id", organizationId)
                            .order("name")
                    )
                }

                const results = await Promise.all(promises)

                if (results[0].error) throw results[0].error
                if (results[1].error) throw results[1].error
                if (results[2]?.error) throw results[2].error

                if (results[0].data) {
                    setProperties(results[0].data)
                }

                if (results[1].data) {
                    setBrokers(results[1].data.map((p: { id: string; full_name: string | null }) => ({ id: p.id, name: p.full_name || "Sem nome" })))
                }

                if (results[2] && results[2].data) {
                    setContacts(results[2].data)
                }
            } catch (error) {
                console.error("Erro ao carregar dependências do contrato:", error)
                const message =
                    typeof error === "object" &&
                    error !== null &&
                    "message" in error &&
                    typeof (error as { message?: unknown }).message === "string"
                        ? (error as { message: string }).message
                        : "Não foi possível carregar imóveis, clientes ou corretores."
                setDepsError(message)
            } finally {
                setFetchingDeps(false)
            }
        }

        fetchDependencies()
    }, [organizationId, contactId, initialData])

    async function onSubmit(data: ContractFormValues) {
        setIsLoading(true)
        setSubmitError(null)
        try {
            const formData = {
                ...data,
                id: initialData?.id,
            }

            const result = await saveContract(formData)

            if (!result.success) {
                setSubmitError(result.error)
                toast.error(result.error)
                return
            }

            setSubmitError(null)
            toast.success(initialData?.id ? "Contrato atualizado!" : "Contrato gerado com sucesso!")
            onSuccess?.()
        } catch (error) {
            console.error(error)
            const message = error instanceof Error && error.message
                ? error.message
                : "Ocorreu um erro inesperado."
            setSubmitError(message)
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {depsError ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {depsError}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="contract_type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Contrato</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="sale">Venda</SelectItem>
                                        <SelectItem value="rent">Locação</SelectItem>
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
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o status" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="draft">Rascunho</SelectItem>
                                        <SelectItem value="active">Ativo (Assinado)</SelectItem>
                                        <SelectItem value="completed">Concluído</SelectItem>
                                        <SelectItem value="canceled">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!contactId && !initialData?.contact_id && (
                        <FormField
                            control={form.control}
                            name="contact_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cliente</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined} disabled={fetchingDeps}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={fetchingDeps ? "Carregando clientes..." : "Selecione o cliente"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {contacts.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="assigned_to"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Corretor Responsável</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={fetchingDeps}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={fetchingDeps ? "Carregando corretores..." : "Selecione o corretor"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {brokers.map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="property_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Imóvel Relacionado</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined} disabled={fetchingDeps}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={fetchingDeps ? "Carregando imóveis..." : "Selecione um imóvel"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {properties.map((prop) => (
                                        <SelectItem key={prop.id} value={prop.id}>
                                            {prop.title} {prop.price ? `- ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.price)}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="final_value"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Valor Final (R$)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        {...field}
                                        value={displayEmptyForZero(field.value as number)}
                                        onChange={(e) => field.onChange(parseNumberInput(e.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="commission_value"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Valor da Comissão (R$)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        {...field}
                                        value={displayEmptyForZero(field.value as number)}
                                        onChange={(e) => field.onChange(parseNumberInput(e.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Data de Início</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(new Date(field.value), "PPP", { locale: ptBR })
                                                ) : (
                                                    <span>Selecione a data</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ? new Date(field.value) : undefined}
                                            onSelect={(date: Date | undefined) => field.onChange(date?.toISOString())}
                                            disabled={(date) =>
                                                date < new Date("1900-01-01")
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Data de Fim (Opcional)</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(new Date(field.value), "PPP", { locale: ptBR })
                                                ) : (
                                                    <span>Selecione a data</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ? new Date(field.value) : undefined}
                                            onSelect={(date: Date | undefined) => field.onChange(date?.toISOString())}
                                            disabled={(date) =>
                                                date < new Date("1900-01-01")
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="document_url"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Link do Documento (Google Drive, DocuSign, etc)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://..." {...field} value={field.value || ''} />
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

                <div className="flex justify-end gap-2 pt-4">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                            Cancelar
                        </Button>
                    )}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData?.id ? "Salvar Alterações" : "Gerar Contrato"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
