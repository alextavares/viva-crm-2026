"use client"

import { useState, useEffect, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn, displayEmptyForZero, parseNumberInput } from "@/lib/utils"

import { DealProposal, proposalSchema, ProposalFormValues } from "@/lib/types"
import { saveProposal } from "@/app/actions/proposals"
import { createClient } from "@/lib/supabase/client"

interface ProposalFormProps {
    contactId: string
    organizationId: string
    brokerId?: string | null
    initialData?: DealProposal
    onSuccess?: () => void
    onCancel?: () => void
}

export function ProposalForm({
    contactId,
    organizationId,
    brokerId,
    initialData,
    onSuccess,
    onCancel
}: ProposalFormProps) {
    const [isPending, startTransition] = useTransition()
    const [properties, setProperties] = useState<{ id: string; title: string; public_code: string | null }[]>([])

    const form = useForm<ProposalFormValues>({
        resolver: zodResolver(proposalSchema),
        defaultValues: {
            property_id: initialData?.property_id || "",
            proposed_value: initialData?.proposed_value || 0,
            payment_conditions: initialData?.payment_conditions || "",
            valid_until: initialData?.valid_until || "",
            status: initialData?.status || "pending",
            notes: initialData?.notes || ""
        }
    })

    // Search properties for select
    useEffect(() => {
        async function fetchProperties() {
            const supabase = createClient()
            const { data } = await supabase
                .from('properties')
                .select('id, title, public_code')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false })

            if (data) {
                setProperties(data)
            }
        }
        fetchProperties()
    }, [organizationId])

    function onSubmit(data: ProposalFormValues) {
        startTransition(async () => {
            const formData = new FormData()
            if (initialData?.id) formData.append("id", initialData.id)
            formData.append("organization_id", organizationId)
            formData.append("contact_id", contactId)
            if (brokerId) formData.append("broker_id", brokerId)

            if (data.property_id) formData.append("property_id", data.property_id)
            formData.append("proposed_value", data.proposed_value.toString())
            if (data.payment_conditions) formData.append("payment_conditions", data.payment_conditions)
            if (data.valid_until) formData.append("valid_until", data.valid_until)
            formData.append("status", data.status)
            if (data.notes) formData.append("notes", data.notes)

            const result = await saveProposal(formData)

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(initialData ? "Proposta atualizada" : "Proposta criada com sucesso")
                onSuccess?.()
            }
        })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                <FormField
                    control={form.control}
                    name="property_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Imóvel Relacionado (Opcional)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um imóvel..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {properties.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.public_code ? `[${p.public_code}] ` : ""}{p.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="proposed_value"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Valor Proposto (R$)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        {...field}
                                        value={displayEmptyForZero(field.value as number)}
                                        onChange={(event) => field.onChange(parseNumberInput(event.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="valid_until"
                        render={({ field }) => (
                            <FormItem className="flex flex-col pt-2.5">
                                <FormLabel>Validade da Proposta</FormLabel>
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
                                                    format(new Date(field.value), "PP", { locale: ptBR })
                                                ) : (
                                                    <span>Selecione uma data</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ? new Date(field.value) : undefined}
                                            onSelect={(date: Date | undefined) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
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
                    name="payment_conditions"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Condições de Pagamento</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Ex: 50% de entrada e parcelamento em 12x..."
                                    className="resize-none"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {initialData && (
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status da Proposta</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="accepted">Aceita</SelectItem>
                                        <SelectItem value="rejected">Rejeitada</SelectItem>
                                        <SelectItem value="counter_offer">Contra-proposta</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <div className="flex justify-end gap-2 pt-4">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
                            Cancelar
                        </Button>
                    )}
                    <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Salvar Alterações" : "Criar Proposta"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
