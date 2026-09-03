"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Building2, AppWindow, Bed, Bath, PencilLine, Globe } from "lucide-react"

import { PropertySiteVisibilityToggle } from "@/components/properties/property-site-visibility-toggle"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import { buildPropertyFixHref } from "@/lib/property-publish-readiness"
import {
    getPropertyOperationalSnapshot,
    getPropertyOperationalStatusLabel,
} from "@/lib/property-operational-readiness"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import type { PropertyListRow } from "@/components/properties/properties-grid"
import {
    refLabel,
    statusLabel,
    propertyTypeLabel,
    transactionTypeLabel,
    purposeLabel,
    propertySiteVisibilityBadge,
    portalSummary,
    portalSummaryBadge,
    propertyMediaQuality,
    propertyOwnerSummary,
    propertyPriceSummary,
    propertyResponsibleSummary,
    propertyStructureSummary,
    getOperationalIssuePreview,
    propertyShowcaseSummary,
} from "@/components/properties/properties-grid"
import { Button } from "@/components/ui/button"

export function PropertiesList({
    properties,
    organizationSlug = null,
    selectedIds = [],
    onToggleSelect,
}: {
    properties: PropertyListRow[]
    organizationSlug?: string | null
    selectedIds?: string[]
    onToggleSelect?: (propertyId: string) => void
}) {
    if (!properties || properties.length === 0) return null

    return (
        <div className="rounded-md border bg-card overflow-hidden">
            <div className="relative w-full overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[44px]"></TableHead>
                            <TableHead className="w-[300px]">Imóvel</TableHead>
                            <TableHead>Valores</TableHead>
                            <TableHead>Mídia & Sistema</TableHead>
                            <TableHead>Proprietário</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {properties.map((property) => (
                            <PropertyRow
                                key={property.id}
                                property={property}
                                organizationSlug={organizationSlug}
                                selected={selectedIds.includes(property.id)}
                                onToggleSelect={onToggleSelect}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function PropertyRow({
    property,
    organizationSlug = null,
    selected = false,
    onToggleSelect,
}: {
    property: PropertyListRow
    organizationSlug?: string | null
    selected?: boolean
    onToggleSelect?: (propertyId: string) => void
}) {
    const [optimisticHideFromSite, setOptimisticHideFromSite] = useState<boolean>(property.hide_from_site ?? false)

    const operational = getPropertyOperationalSnapshot(property)
    const mediaQuality = propertyMediaQuality(property)
    const priceSummary = propertyPriceSummary(property)
    const responsibleSummary = propertyResponsibleSummary(property)
    const ownerSummary = propertyOwnerSummary(property)
    const structureSummary = propertyStructureSummary(property)
    const portalBadge = portalSummaryBadge(property)
    const operationalLabel = getPropertyOperationalStatusLabel(operational.status)
    const hasOperationalIssues = operational.displayIssues.length > 0
    const propertyWithVisibility = {
        ...property,
        hide_from_site: optimisticHideFromSite,
    }
    const showcaseSummary = propertyShowcaseSummary(propertyWithVisibility)
    const operationalBadgeClass =
        operational.status === "draft"
            ? "bg-slate-100 text-slate-800 border-slate-200"
            : operational.status === "publishable"
                ? "bg-sky-100 text-sky-800 border-sky-200"
                : operational.status === "published_low_quality"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
    const publicUrl = organizationSlug ? `/s/${organizationSlug}/imovel/${property.id}` : null
    const siteVisibility = propertySiteVisibilityBadge(property, optimisticHideFromSite)
    const canOpenOnSite = showcaseSummary.vitrine.canOpenPublicLink
    const issuePreview = getOperationalIssuePreview(operational.displayIssues)
    const firstOperationalIssue = issuePreview.visibleIssues[0] ?? null
    const firstActionIssue = firstOperationalIssue ?? showcaseSummary.firstActionIssue
    const correctionActionClass = firstActionIssue?.severity === "critical"
        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"

    return (
        <TableRow className="group">
            <TableCell className="align-top">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect?.(property.id)}
                    aria-label={`Selecionar ${property.title}`}
                    className="mt-1 h-4 w-4"
                />
            </TableCell>
            {/* Imóvel */}
            <TableCell className="align-top">
                <div className="flex gap-3">
                    <Link href={`/properties/${property.id}`} className="shrink-0 flex-none block w-20 h-20 bg-muted rounded overflow-hidden relative border">
                        {(property.images && property.images.length > 0) || (property.image_paths && property.image_paths.length > 0) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={
                                    resolveMediaPathUrl("properties", property.image_paths?.[0]) ??
                                    resolveMediaUrl(property.images?.[0]) ??
                                    property.images?.[0] ??
                                    ""
                                }
                                alt={property.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground/50">
                                <Building2 className="h-6 w-6" />
                            </div>
                        )}
                        <div className="absolute top-1 left-1 line-clamp-1 max-w-full text-[10px] bg-black/60 text-white px-1 rounded shadow text-ellipsis">
                            {refLabel(property)}
                        </div>
                        <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
                            Capa principal
                        </div>
                    </Link>
                    <div className="flex flex-col max-w-[200px] gap-1">
                        <Link href={`/properties/${property.id}`} className="font-medium text-sm line-clamp-2 hover:underline">
                            {property.title}
                        </Link>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                            {property.address?.full_address ||
                                [property.address?.neighborhood, property.address?.city, property.address?.state]
                                    .filter(Boolean)
                                    .join(" - ") ||
                                'Endereço não informado'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className={`flex items-center gap-1 ${structureSummary.hasBedrooms ? "" : "text-amber-700"}`}><Bed className="h-3 w-3" /> {structureSummary.bedrooms}</span>
                            <span className={`flex items-center gap-1 ${structureSummary.hasBathrooms ? "" : "text-amber-700"}`}><Bath className="h-3 w-3" /> {structureSummary.bathrooms}</span>
                            <span className={`flex items-center gap-1 ${structureSummary.hasBuiltArea ? "" : "text-amber-700"}`}><AppWindow className="h-3 w-3" /> {structureSummary.builtArea}</span>
                        </div>
                    </div>
                </div>
            </TableCell>

            {/* Valores e Tipo */}
            <TableCell className="align-top">
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <div className={`font-semibold ${priceSummary.className}`}>
                        {priceSummary.label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                            {transactionTypeLabel(property.transaction_type)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium whitespace-nowrap">
                            {purposeLabel(property.purpose)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium border-muted-foreground/30 whitespace-nowrap text-muted-foreground">
                            {propertyTypeLabel(property.type)}
                        </Badge>
                    </div>
                    {property.financing_allowed ? (
                        <div className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm inline-block w-fit cursor-default" title="Aceita financiamento">
                            Aceita financiamento
                        </div>
                    ) : null}
                </div>
            </TableCell>

            {/* Mídia & Site */}
            <TableCell className="align-top min-w-[180px]">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={property.status === 'available' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0"
                            title="Status comercial do imóvel"
                        >
                            {statusLabel(property.status)}
                        </Badge>
                    </div>

                    <div className="flex flex-col gap-1.5 border-l-2 pl-2 border-muted">
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={canOpenOnSite ? "secondary" : "outline"}
                                className={`text-[10px] px-1.5 py-0 ${siteVisibility.className}`}
                                title="Visibilidade no site e portais associados"
                            >
                                {siteVisibility.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${operationalBadgeClass}`}>
                                {operationalLabel}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${showcaseSummary.readinessBadge.className}`}>
                                {showcaseSummary.readinessBadge.label}
                            </Badge>
                            {showcaseSummary.hiddenBadge ? (
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${showcaseSummary.hiddenBadge.className}`}>
                                    {showcaseSummary.hiddenBadge.label}
                                </Badge>
                            ) : null}
                            <PropertySiteVisibilityToggle
                                propertyId={property.id}
                                hideFromSite={optimisticHideFromSite}
                                onOptimisticToggle={(newState) => setOptimisticHideFromSite(newState)}
                                onRevertToggle={() => setOptimisticHideFromSite(property.hide_from_site ?? false)}
                            />
                        </div>

                        <div className="line-clamp-1" title={portalSummary(property)}>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${portalBadge.className}`}>
                                {portalBadge.label}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Badge variant="outline" className={mediaQuality.className}>
                                {mediaQuality.label}
                            </Badge>
                            <span>{mediaQuality.count} foto(s)</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-2">
                            {operational.reasonSummary}
                        </div>
                        <div className={`text-[10px] font-medium line-clamp-2 ${showcaseSummary.summaryClassName}`}>
                            {showcaseSummary.summaryText}
                        </div>

                        {hasOperationalIssues ? (
                            <div className="flex flex-wrap gap-1">
                                {issuePreview.visibleIssues.map((issue) => (
                                    <Badge
                                        key={issue.code}
                                        variant="outline"
                                        className={
                                            issue.severity === "critical"
                                                ? "bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0"
                                                : "bg-amber-50 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0"
                                        }
                                    >
                                        {issue.label}
                                    </Badge>
                                ))}
                                {issuePreview.hiddenCount > 0 ? (
                                    <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground text-[10px] px-1.5 py-0">
                                        +{issuePreview.hiddenCount}
                                    </Badge>
                                ) : null}
                            </div>
                        ) : null}
                        {showcaseSummary.reasonLabels.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {showcaseSummary.reasonLabels.map((reason) => (
                                    <Badge
                                        key={reason.code}
                                        variant="outline"
                                        className={
                                            reason.severity === "critical"
                                                ? "bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0"
                                                : "bg-amber-50 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0"
                                        }
                                    >
                                        {reason.label}
                                    </Badge>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </TableCell>

            {/* Proprietário */}
            <TableCell className="align-top">
                <div className="flex flex-col gap-1 text-sm text-foreground max-w-[180px]">
                    <span className="text-xs text-muted-foreground">
                        Responsável: <span className={responsibleSummary.className}>{responsibleSummary.label}</span>
                    </span>
                    {ownerSummary.href ? (
                        <Link
                            href={ownerSummary.href}
                            className="line-clamp-2 font-medium text-foreground hover:underline"
                            title={ownerSummary.label}
                        >
                            {ownerSummary.label}
                        </Link>
                    ) : (
                        <span className={`line-clamp-2 ${ownerSummary.className}`} title={ownerSummary.label}>
                            {ownerSummary.label}
                        </span>
                    )}
                    {firstActionIssue ? (
                        <Link
                            href={buildPropertyFixHref(property.id, firstActionIssue.focusFieldId)}
                            className={`text-xs underline ${firstActionIssue.severity === "critical" ? "text-red-700" : "text-amber-800"}`}
                        >
                            Corrigir: {firstActionIssue.label}
                        </Link>
                    ) : null}
                </div>
            </TableCell>

            {/* Ações */}
            <TableCell className="align-top text-right pr-4">
                <div className="flex flex-col items-end gap-2 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1">
                        <Link href={`/properties/${property.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar imóvel">
                                <PencilLine className="h-4 w-4" />
                            </Button>
                        </Link>
                        {publicUrl && canOpenOnSite ? (
                            <Link href={publicUrl} target="_blank" rel="noreferrer">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir no site">
                                    <Globe className="h-4 w-4" />
                                </Button>
                            </Link>
                        ) : null}
                    </div>
                    {firstActionIssue ? (
                        <Link href={buildPropertyFixHref(property.id, firstActionIssue.focusFieldId)}>
                            <Button variant="outline" size="sm" className={`h-8 text-xs ${correctionActionClass}`}>
                                Corrigir: {firstActionIssue.label}
                            </Button>
                        </Link>
                    ) : null}
                </div>
            </TableCell>
        </TableRow>
    )
}
