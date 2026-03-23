"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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

import { contractSchema, type DealContract } from "@/lib/types"
import { saveContract } from "@/app/actions/contracts"
import { createClient } from "@/lib/supabase/client"

interface ContractFormProps {
    contactId?: string
    organizationId: string
    brokerId?: string | null
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

export function ContractForm({
    contactId,
    organizationId,
    brokerId,
    initialData,
    onSuccess,
    onCancel
}: ContractFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [properties, setProperties] = useState<PropertyOption[]>([])
    const [contacts, setContacts] = useState<ContactOption[]>([])
    const [fetchingDeps, setFetchingDeps] = useState(true)

    const form = useForm<Partial<DealContract>>({
        resolver: zodResolver(contractSchema),
        defaultValues: {
            organization_id: organizationId,
            contact_id: initialData?.contact_id || contactId || "",
            property_id: initialData?.property_id || "",
            broker_id: initialData?.broker_id || brokerId || "",
            contract_type: initialData?.contract_type || "sale",
            status: initialData?.status || "draft",
            final_value: initialData?.final_value || 0,
            commission_value: initialData?.commission_value || 0,
            start_date: initialData?.start_date || undefined,
            end_date: initialData?.end_date || undefined,
            document_url: initialData?.document_url || "",
            ...initialData
        }
    })

    useEffect(() => {
        const fetchDependencies = async () => {
            setFetchingDeps(true)
            const supabase = createClient()

            // Only fetch what we need based on context (if contact is fixed, no need to list all contacts)
            const promises = [
                supabase
                    .from("properties")
                    .select("id, title, price")
                    .eq("organization_id", organizationId)
                    .order("title")
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

            if (results[0].data) {
                setProperties(results[0].data)
            }

            if (results[1] && results[1].data) {
                setContacts(results[1].data)
            }

            setFetchingDeps(false)
        }

        fetchDependencies()
    }, [organizationId, contactId, initialData])

    async function onSubmit(data: Partial<DealContract>) {
        setIsLoading(true)
        try {
            const formData = {
                ...data,
                id: initialData?.id,
            }

            // Allow string parsing to float if user typed with keyboard (controlled component nature)
            if (typeof formData.final_value === "string") {
                formData.final_value = parseFloat(formData.final_value)
            }
            if (typeof formData.commission_value === "string") {
                formData.commission_value = parseFloat(formData.commission_value)
            }

            const result = await saveContract(formData)

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success(initialData?.id ? "Contrato atualizado!" : "Contrato gerado com sucesso!")
            onSuccess?.()
        } catch (error) {
            toast.error("Ocorreu um erro inesperado.")
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="contract_type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Contrato</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                {!contactId && !initialData?.contact_id && (
                    <FormField
                        control={form.control}
                        name="contact_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cliente</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={fetchingDeps}>
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
                    name="property_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Imóvel Relacionado</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={fetchingDeps}>
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
