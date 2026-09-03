"use client"

import { updateContactDealStage } from "@/app/actions/contacts"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DealStageBadge } from "@/components/contacts/deal-stage-badge"
import { DEAL_STAGES, DEAL_STAGE_LABELS, getPropertyTypeLabel, type DealStage } from "@/lib/types"
import { Building, Globe, Home, Mail, MapPin, Phone, UserRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
    getContactDomainLabel,
    getTypeLabel,
    getStatusLabel,
    getStatusColor,
    getContactSourceLabel,
    buildSlaBadge,
    type LeadDistributionSettings
} from "@/components/contacts/contacts-grid"

interface SiteMeta {
    source: string
    domain: string | null
    lastEventAt: string
}

export interface ContactRecordSummaryProps {
    contactId: string
    name: string
    type: string
    status: string
    dealStage?: string | null
    canEditDealStage?: boolean
    email?: string | null
    phone?: string | null
    city?: string | null
    siteMeta?: SiteMeta | null
    latestLeadAt?: string | null
    responsibleName?: string | null
    linkedPropertiesCount?: number
    leadDistributionSettings: LeadDistributionSettings
    interestCity?: string | null
    interestType?: string | null
    interestBedrooms?: number | null
    interestPriceMax?: number | null
    leadPropertyContext?: { id: string; title: string } | null
    nextActionLabel?: string | null
    lastInteraction?: { date: string, description: string, isMessage: boolean } | null
    negotiationStatus?: { label: string, color: 'success' | 'warning' | 'info' | 'default' } | null
    children?: React.ReactNode
}

export function ContactRecordSummary({
    contactId,
    name,
    type,
    status,
    dealStage,
    canEditDealStage = false,
    email,
    phone,
    city,
    siteMeta,
    latestLeadAt,
    responsibleName,
    linkedPropertiesCount,
    leadDistributionSettings,
    interestCity,
    interestType,
    interestBedrooms,
    interestPriceMax,
    leadPropertyContext,
    nextActionLabel,
    lastInteraction,
    negotiationStatus,
    children
}: ContactRecordSummaryProps) {
    const optimisticStatus = status
    const safeDealStage = (DEAL_STAGES.includes((dealStage ?? "lead") as DealStage)
        ? (dealStage ?? "lead")
        : "lead") as DealStage
    const [selectedDealStage, setSelectedDealStage] = useState<DealStage>(safeDealStage)
    const [isPending, startTransition] = useTransition()
    const slaBadge = buildSlaBadge(latestLeadAt || null, optimisticStatus, leadDistributionSettings)
    const interestProfile = [
        interestCity ? `Cidade: ${interestCity}` : null,
        interestType ? `Tipo: ${getPropertyTypeLabel(interestType)}` : null,
        typeof interestBedrooms === "number" && interestBedrooms > 0
            ? `${interestBedrooms} quarto${interestBedrooms > 1 ? "s" : ""}`
            : null,
        typeof interestPriceMax === "number" && interestPriceMax > 0
            ? new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
            }).format(interestPriceMax)
            : null,
    ].filter(Boolean) as string[]

    useEffect(() => {
        setSelectedDealStage(safeDealStage)
    }, [safeDealStage])

    function handleDealStageChange(nextStage: string) {
        if (!DEAL_STAGES.includes(nextStage as DealStage)) return
        const nextValue = nextStage as DealStage
        if (nextValue === selectedDealStage) return

        if (
            (nextValue === "won" || nextValue === "lost") &&
            !window.confirm(
                `Confirmar marcação da negociação como ${DEAL_STAGE_LABELS[nextValue].toLowerCase()}?`
            )
        ) {
            return
        }

        const previousStage = selectedDealStage
        setSelectedDealStage(nextValue)

        startTransition(async () => {
            try {
                const result = await updateContactDealStage({
                    contactId,
                    dealStage: nextValue,
                })

                if (!result.success) {
                    setSelectedDealStage(previousStage)
                    toast.error(result.error)
                    return
                }

                toast.success("Estágio da negociação atualizado.")
            } catch (error) {
                setSelectedDealStage(previousStage)
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : "Erro ao atualizar estágio da negociação."
                toast.error(message)
            }
        })
    }

    return (
        <div className="overflow-hidden rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
                <div className="min-w-0 space-y-4">
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-start gap-2">
                            <h2 className="min-w-0 flex-1 break-words text-xl font-semibold sm:text-2xl" title={name}>
                                {name}
                            </h2>
                            <Badge
                                variant="outline"
                                className={type === "lead" ? "border-primary/30 text-primary" : type === "owner" ? "border-purple-200 text-purple-700" : ""}
                            >
                                {getTypeLabel(type)}
                            </Badge>
                            {slaBadge ? (
                                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${slaBadge.className}`}>
                                    SLA: {slaBadge.label}
                                </span>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                            {phone ? (
                                <span className="flex items-center gap-1.5 font-medium text-foreground">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {phone}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 italic text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                    Sem telefone
                                </span>
                            )}

                            {email ? (
                                <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate" title={email}>{email}</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 italic text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    Sem email
                                </span>
                            )}

                            {city ? (
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span className="truncate" title={city}>{city}</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 italic text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    Sem cidade
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border bg-muted/20 p-3">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Imóvel de interesse</div>
                            {leadPropertyContext ? (
                                <Link
                                    href={`/properties/${leadPropertyContext.id}`}
                                    className="mt-2 block break-words text-sm font-medium text-primary hover:underline"
                                    title={leadPropertyContext.title}
                                >
                                    {leadPropertyContext.title}
                                </Link>
                            ) : (
                                <div className="mt-2 text-sm text-muted-foreground">Interesse ainda não identificado</div>
                            )}
                        </div>

                        <div className="rounded-lg border bg-muted/20 p-3">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status e estágio</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant={getStatusColor(optimisticStatus) as "default" | "secondary" | "destructive" | "outline"} className="whitespace-nowrap">
                                    {getStatusLabel(optimisticStatus)}
                                </Badge>
                                <DealStageBadge stage={selectedDealStage} />
                                {negotiationStatus ? (
                                    <Badge
                                        variant="outline"
                                        className={`whitespace-nowrap ${
                                            negotiationStatus.color === "success"
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                : negotiationStatus.color === "warning"
                                                    ? "border-amber-500 bg-amber-50 text-amber-700"
                                                    : negotiationStatus.color === "info"
                                                        ? "border-blue-500 bg-blue-50 text-blue-700"
                                                        : ""
                                        }`}
                                    >
                                        {negotiationStatus.label}
                                    </Badge>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/20 p-3">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Próxima ação</div>
                            <div className="mt-2 break-words text-sm font-medium">
                                {nextActionLabel || "Registrar o próximo passo do atendimento"}
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/20 p-3">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Último contato</div>
                            {lastInteraction ? (
                                <div className="mt-2 space-y-1">
                                    <div className={`text-sm font-medium break-words ${lastInteraction.isMessage ? "text-emerald-600" : "text-foreground"}`}>
                                        {lastInteraction.description}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Intl.DateTimeFormat("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        }).format(new Date(lastInteraction.date))}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 text-sm text-muted-foreground">Ainda sem histórico recente.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-lg border bg-card p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Contexto e responsável</div>
                        <div className="mt-2 space-y-2 text-sm">
                            <div className={`flex items-start gap-1.5 ${responsibleName ? "text-foreground" : "italic text-muted-foreground"}`}>
                                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="break-words">Responsável: {responsibleName || "Sem responsável"}</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-foreground">
                                {siteMeta ? (
                                    <>
                                        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="break-words">
                                            {siteMeta.source === "site"
                                                ? `Origem site${siteMeta.domain ? ` · ${getContactDomainLabel(siteMeta.domain)}` : ""}`
                                                : getContactSourceLabel(siteMeta.source)}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Building className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span>Cadastro direto</span>
                                    </>
                                )}
                            </div>
                            {type === "owner" ? (
                                <div className="inline-flex w-max rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {linkedPropertiesCount === 1 ? "1 imóvel vinculado" : `${linkedPropertiesCount || 0} imóveis vinculados`}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Andamento comercial</div>
                        <div className="mt-2 space-y-2">
                            <div className="text-xs text-muted-foreground">Estágio da negociação</div>
                            {canEditDealStage ? (
                                <div className="space-y-2">
                                    <Select
                                        value={selectedDealStage}
                                        onValueChange={handleDealStageChange}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger className="h-9 w-full min-w-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                            {DEAL_STAGES.map((stage) => (
                                                <SelectItem key={stage} value={stage}>
                                                    {DEAL_STAGE_LABELS[stage]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isPending ? (
                                        <span className="text-xs text-muted-foreground">Salvando...</span>
                                    ) : null}
                                </div>
                            ) : (
                                <DealStageBadge stage={selectedDealStage} />
                            )}

                            {leadPropertyContext ? (
                                <Link
                                    href={`/properties/${leadPropertyContext.id}`}
                                    className="flex items-center gap-1.5 break-words text-sm text-primary hover:underline"
                                    title={leadPropertyContext.title}
                                >
                                    <Home className="h-3.5 w-3.5 shrink-0" />
                                    <span className="break-words">{leadPropertyContext.title}</span>
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {children && (
                <div className="mt-1 flex flex-wrap items-center gap-2 border-t pt-4 lg:justify-end">
                    {children}
                </div>
            )}

            <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Perfil de interesse
                </div>
                {interestProfile.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {interestProfile.map((item) => (
                            <Badge key={item} variant="outline">
                                {item}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <div className="mt-2 text-sm text-muted-foreground">
                        Perfil comercial ainda não preenchido.
                    </div>
                )}
            </div>

        </div>
    )
}
