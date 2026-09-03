"use client"

import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { buildPropertyFixHref } from "@/lib/property-publish-readiness"
import {
    getPropertyOperationalSnapshot,
    getPropertyOperationalStatusLabel,
} from "@/lib/property-operational-readiness"
import {
    refLabel,
    statusLabel,
    propertyTypeLabel,
    transactionTypeLabel,
    purposeLabel,
    portalSummary,
    propertyOwnerSummary,
    propertyPriceSummary,
    propertyResponsibleSummary,
    propertySiteVisibilityBadge,
    getOperationalIssuePreview,
} from "@/components/properties/properties-grid"
import { PropertySiteVisibilityToggle } from "@/components/properties/property-site-visibility-toggle"
import { getPropertyVitrineStatus } from "@/lib/property-vitrine-status"

import type { PropertyListRow } from "@/components/properties/properties-grid"

interface PropertyRecordSummaryProps {
    property: PropertyListRow & {
        created_at?: string | null
        updated_at?: string | null
        owner_contact?: { id: string; name: string } | null
        broker?: { id: string; full_name: string } | null
    }
    organizationSlug?: string | null
}

export function PropertyRecordSummary({ property, organizationSlug = null }: PropertyRecordSummaryProps) {
    const [optimisticHideFromSite, setOptimisticHideFromSite] = useState<boolean>(property.hide_from_site ?? false)
    if (!property) return null

    const priceSummary = propertyPriceSummary(property)
    const ownerSummary = propertyOwnerSummary(property)
    const responsibleSummary = propertyResponsibleSummary(property)
    const propertyWithVisibility = {
        ...property,
        hide_from_site: optimisticHideFromSite,
    }
    const siteVisibility = propertySiteVisibilityBadge(property, optimisticHideFromSite)
    const operational = getPropertyOperationalSnapshot(property)
    const vitrine = getPropertyVitrineStatus(propertyWithVisibility)
    const operationalLabel = getPropertyOperationalStatusLabel(operational.status)
    const issuePreview = getOperationalIssuePreview(operational.displayIssues)
    const firstShowcaseIssue = vitrine.firstActionIssue
    const publicListUrl = organizationSlug ? `/s/${organizationSlug}` : null
    const publicPropertyUrl = publicListUrl ? `${publicListUrl}/imovel/${property.id}` : null
    const canOpenOnSite = Boolean(publicPropertyUrl && vitrine.canOpenPublicLink)
    const operationalBadgeClass =
        operational.status === "draft"
            ? "bg-slate-100 text-slate-800 border-slate-200"
            : operational.status === "publishable"
                ? "bg-sky-100 text-sky-800 border-sky-200"
                : operational.status === "published_low_quality"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200"

    // Formatting dates
    const createdAt = property.created_at ? new Date(property.created_at).toLocaleDateString('pt-BR') : "Desconhecido"
    const updatedAt = property.updated_at ? new Date(property.updated_at).toLocaleDateString('pt-BR') : "Desconhecido"

    return (
        <div className="space-y-4 mb-6">
            <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Status operacional</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${operationalBadgeClass}`}>
                                {operationalLabel}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{operational.reasonSummary}</p>
                    </div>
                    {issuePreview.visibleIssues.length > 0 ? (
                        <div className="min-w-0 space-y-2 rounded-md border bg-background/80 p-3 lg:max-w-sm">
                            <div className="text-xs font-medium text-muted-foreground">Principais pendências</div>
                            <div className="flex flex-wrap gap-2">
                                {issuePreview.visibleIssues.map((issue) => (
                                    <Badge
                                        key={issue.code}
                                        variant="outline"
                                        className={
                                            issue.severity === "critical"
                                                ? "border-red-200 bg-red-50 text-red-700"
                                                : "border-amber-200 bg-amber-50 text-amber-800"
                                        }
                                    >
                                        {issue.label}
                                    </Badge>
                                ))}
                                {issuePreview.hiddenCount > 0 ? (
                                    <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground">
                                        +{issuePreview.hiddenCount}
                                    </Badge>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {issuePreview.visibleIssues.map((issue) => (
                                    <Link
                                        key={`${issue.code}-fix`}
                                        href={buildPropertyFixHref(property.id, issue.focusFieldId)}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        Corrigir: {issue.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                            Cadastro pronto para publicação com boa leitura operacional.
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-lg border bg-background/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Status da vitrine</span>
                            <Badge variant="outline" className={vitrine.className}>
                                {vitrine.label}
                            </Badge>
                            <Badge variant="outline" className={siteVisibility.className}>
                                {siteVisibility.label}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{vitrine.helper}</p>
                        {firstShowcaseIssue ? (
                            <div className="flex flex-wrap gap-2">
                                <Badge
                                    variant="outline"
                                    className={
                                        firstShowcaseIssue.severity === "critical"
                                            ? "border-red-200 bg-red-50 text-red-700"
                                            : "border-amber-200 bg-amber-50 text-amber-800"
                                    }
                                >
                                    {firstShowcaseIssue.label}
                                </Badge>
                                <Link
                                    href={buildPropertyFixHref(property.id, firstShowcaseIssue.focusFieldId)}
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    Corrigir pendência principal
                                </Link>
                            </div>
                        ) : (
                            <div className="text-xs text-emerald-700">
                                {vitrine.status === "ready_hidden"
                                    ? "Sem pendências críticas. O próximo passo é publicar o imóvel no site."
                                    : vitrine.status === "live"
                                        ? "Sem pendências críticas. O imóvel já está publicado no site."
                                        : "Sem pendências críticas neste recorte."}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <PropertySiteVisibilityToggle
                            propertyId={property.id}
                            hideFromSite={optimisticHideFromSite}
                            onOptimisticToggle={(nextState) => setOptimisticHideFromSite(nextState)}
                            onRevertToggle={() => setOptimisticHideFromSite(property.hide_from_site ?? false)}
                        />
                        {publicListUrl ? (
                            <Link href={publicListUrl} target="_blank" rel="noreferrer">
                                <Badge variant="outline" className="h-9 cursor-pointer px-3 text-xs hover:bg-muted/40">
                                    Abrir vitrine
                                </Badge>
                            </Link>
                        ) : null}
                        {canOpenOnSite && publicPropertyUrl ? (
                            <Link href={publicPropertyUrl} target="_blank" rel="noreferrer">
                                <Badge variant="outline" className="h-9 cursor-pointer border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-800 hover:bg-emerald-100">
                                    Conferir publicação no site
                                </Badge>
                            </Link>
                        ) : (
                            <Badge variant="outline" className="h-9 px-3 text-xs text-muted-foreground">
                                Link público liberado após publicação e curadoria
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/20 text-sm">
            {/* Referência & Preço */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Referência (Ref)</span>
                <span className="font-semibold">{refLabel(property)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Preço</span>
                <span className={`font-semibold ${priceSummary.className}`}>{priceSummary.label}</span>
            </div>

            {/* Status & Visibilidade */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Status Comercial</span>
                <div className="h-5 flex items-center">
                    <Badge 
                        variant={property.status === 'available' ? 'default' : property.status === 'sold' || property.status === 'rented' ? 'outline' : 'secondary'} 
                        className={`text-[10px] px-1.5 py-0 h-4 ${
                            property.status === 'available' ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                        }`}
                    >
                        {statusLabel(property.status)}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-col gap-1 border-l pl-3">
                <span className="text-xs text-muted-foreground font-medium">Exibição no site</span>
                <div className="h-5 flex items-center">
                    <Badge
                        variant={siteVisibility.visible ? "secondary" : "outline"}
                        className={`text-[10px] px-1.5 py-0 h-4 ${siteVisibility.className}`}
                    >
                        {siteVisibility.label}
                    </Badge>
                </div>
            </div>

            {/* Portais */}
            <div className="flex flex-col gap-1 lg:col-span-2 xl:col-span-1">
                <span className="text-xs text-muted-foreground font-medium">Portais</span>
                <span className="text-xs font-medium text-foreground">{portalSummary(property)}</span>
            </div>

            {/* Características */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Transação</span>
                <span>{transactionTypeLabel(property.transaction_type)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Uso</span>
                <span>{purposeLabel(property.purpose)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Tipo</span>
                <span>{propertyTypeLabel(property.type)}</span>
            </div>

            {/* Relacionamentos: Proprietário e Corretor */}
            <div className="flex flex-col gap-1 border-l pl-3">
                <span className="text-xs text-muted-foreground font-medium">Proprietário</span>
                {property.owner_contact?.id ? (
                    <Link href={`/contacts/${property.owner_contact.id}`} className="font-medium hover:underline line-clamp-1" title={property.owner_contact.name}>
                        {property.owner_contact.name}
                    </Link>
                ) : (
                    <span className={`text-xs ${ownerSummary.className}`}>{ownerSummary.label}</span>
                )}
            </div>
            <div className="flex flex-col gap-1 border-l pl-3 lg:col-span-1 xl:col-span-1">
                <span className="text-xs text-muted-foreground font-medium">Corretor Responsável</span>
                {property.broker?.full_name ? (
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {property.broker.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium line-clamp-1">{property.broker.full_name}</span>
                    </div>
                ) : (
                    <span className={`text-xs ${responsibleSummary.className}`}>{responsibleSummary.label}</span>
                )}
            </div>

            {/* Datas */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Cadastrado em</span>
                <span className="text-xs">{createdAt}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Atualizado em</span>
                <span className="text-xs">{updatedAt}</span>
            </div>
        </div>
        </div>
    )
}
