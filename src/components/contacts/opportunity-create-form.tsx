"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createOpportunityFromContact } from "@/app/actions/opportunities"
import {
    OPPORTUNITY_STAGES,
    OPPORTUNITY_STAGE_LABELS,
    type OpportunityStage,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface OpportunityCreateFormProps {
    contactId: string
    propertyId?: string | null
    propertyTitle?: string | null
}

export function OpportunityCreateForm({ contactId, propertyId = null, propertyTitle = null }: OpportunityCreateFormProps) {
    const router = useRouter()
    const [stage, setStage] = useState<OpportunityStage>("new")
    const [estimatedValue, setEstimatedValue] = useState("")
    const [isPending, startTransition] = useTransition()

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        const trimmed = estimatedValue.trim().replace(/\./g, "").replace(",", ".")
        const value = trimmed ? Number(trimmed) : null

        startTransition(async () => {
            const result = await createOpportunityFromContact({
                contactId,
                propertyId,
                stage,
                estimatedValue: value,
            })

            if (!result.success) {
                toast.error(result.error)
                return
            }

            toast.success(result.data.alreadyExisted ? "Oportunidade aberta já existente." : "Oportunidade criada.")
            setEstimatedValue("")
            router.refresh()
        })
    }

    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Oportunidade</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                {propertyTitle
                    ? `Vinculada a ${propertyTitle}.`
                    : "Sem imóvel vinculado. Crie a partir do interesse identificado."}
            </p>
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid flex-1 gap-1.5">
                    <label htmlFor="opportunity-stage" className="text-xs font-medium text-muted-foreground">
                        Estágio inicial
                    </label>
                    <Select value={stage} onValueChange={(value) => setStage(value as OpportunityStage)} disabled={isPending}>
                        <SelectTrigger id="opportunity-stage" className="h-9 w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {OPPORTUNITY_STAGES.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {OPPORTUNITY_STAGE_LABELS[option]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid flex-1 gap-1.5">
                    <label htmlFor="opportunity-value" className="text-xs font-medium text-muted-foreground">
                        Valor estimado (R$, opcional)
                    </label>
                    <Input
                        id="opportunity-value"
                        inputMode="decimal"
                        placeholder="Ex.: 450000"
                        value={estimatedValue}
                        onChange={(event) => setEstimatedValue(event.target.value)}
                        disabled={isPending}
                    />
                </div>
                <Button type="submit" disabled={isPending}>
                    {isPending ? "Criando..." : "Criar oportunidade"}
                </Button>
            </form>
        </div>
    )
}
