"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, MapPin, Bed, Bath, AppWindow, Globe, PencilLine } from "lucide-react"

import { PropertySiteVisibilityToggle } from "@/components/properties/property-site-visibility-toggle"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import { buildPropertyFixHref } from "@/lib/property-publish-readiness"
import {
    getPropertyOperationalSnapshot,
    getPropertyOperationalStatusLabel,
    type PropertyOperationalIssue,
} from "@/lib/property-operational-readiness"
import { getPropertyVitrineStatus } from "@/lib/property-vitrine-status"
import { getPropertyTypeLabel } from "@/lib/types"

export type PropertyListRow = {
    id: string
    public_code?: string | null
    external_id?: string | null
    assigned_to?: string | null
    title: string
    description?: string | null
    price?: number | null
    type?: string | null
    transaction_type?: string | null
    purpose?: string | null
    status?: string | null

    owner_contact?: { id?: string | null; name: string } | null
    broker?: { full_name?: string | null } | null
    hide_from_site?: boolean | null
    financing_allowed?: boolean | null
    publish_to_portals?: boolean | null
    publish_zap?: boolean | null
    publish_imovelweb?: boolean | null
    publish_olx?: boolean | null
    built_area?: number | null
    total_area?: number | null
    images?: string[] | null
    image_paths?: string[] | null
    address?: {
        full_address?: string | null
        street?: string | null
        neighborhood?: string | null
        city?: string | null
        state?: string | null
    } | null
    features?: {
        bedrooms?: number | null
        bathrooms?: number | null
        area?: number | null
    } | null
}

export function refLabel(property: { id?: string | null; public_code?: string | null; external_id?: string | null }) {
    const publicCode = typeof property.public_code === "string" ? property.public_code.trim() : ""
    if (publicCode) return publicCode

    return typeof property?.id === "string" ? property.id.slice(0, 8) : "-"
}

export function statusLabel(status?: string | null) {
    if (!status) return "Indefinido"
    if (status === "available") return "Disponível"
    if (status === "inactive") return "Inativo"
    if (status === "pending_approval") return "Aguardando aprovação"
    if (status === "sold") return "Vendido"
    if (status === "rented") return "Alugado"
    return status
}

export function propertyTypeLabel(type?: string | null) {
    return getPropertyTypeLabel(type)
}

export function transactionTypeLabel(transactionType?: string | null) {
    if (!transactionType) return "Transação indefinida"
    if (transactionType === "sale") return "Venda"
    if (transactionType === "rent") return "Locação"
    if (transactionType === "seasonal") return "Temporada"
    return transactionType
}

export function purposeLabel(purpose?: string | null) {
    if (!purpose) return "Finalidade indefinida"
    if (purpose === "residential") return "Residencial"
    if (purpose === "commercial") return "Comercial"
    return purpose
}

export function portalSummary(property: Pick<PropertyListRow, 'publish_to_portals' | 'publish_zap' | 'publish_imovelweb' | 'publish_olx'>) {
    if (!property.publish_to_portals) return "Portais desligados"

    const enabled = [
        property.publish_zap ? "ZAP" : null,
        property.publish_imovelweb ? "Imovelweb" : null,
        property.publish_olx ? "OLX" : null,
    ].filter(Boolean)

    if (enabled.length === 0) return "Portais habilitados sem canal selecionado"

    return `Enviado aos portais: ${enabled.join(" · ")}`
}

export function portalSummaryBadge(property: Pick<PropertyListRow, 'publish_to_portals' | 'publish_zap' | 'publish_imovelweb' | 'publish_olx'>) {
    const label = portalSummary(property)

    if (!property.publish_to_portals) {
        return {
            label,
            className: "border-muted-foreground/20 text-muted-foreground",
        }
    }

    if (!property.publish_zap && !property.publish_imovelweb && !property.publish_olx) {
        return {
            label,
            className: "bg-amber-50 text-amber-800 border-amber-200",
        }
    }

    return {
        label,
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    }
}

export function propertyImageCount(property: Pick<PropertyListRow, "images" | "image_paths">) {
    return Math.max(property.images?.length ?? 0, property.image_paths?.length ?? 0)
}

export function propertyMediaQuality(property: Pick<PropertyListRow, "images" | "image_paths">) {
    const count = propertyImageCount(property)

    if (count === 0) {
        return {
            label: "Sem fotos",
            count,
            className: "bg-red-50 text-red-700 border-red-200",
        }
    }

    if (count < 5) {
        return {
            label: "Galeria fraca",
            count,
            className: "bg-amber-50 text-amber-800 border-amber-200",
        }
    }

    return {
        label: "Boa galeria",
        count,
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    }
}

export function propertyPriceSummary(property: Pick<PropertyListRow, "price">) {
    if (!property.price || property.price <= 0) {
        return {
            label: "Sem preço",
            className: "text-red-700",
        }
    }

    return {
        label: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price),
        className: "text-primary",
    }
}

export function propertyStructureSummary(property: Pick<PropertyListRow, "features" | "built_area" | "total_area">) {
    const builtArea = property.built_area || property.features?.area || null

    return {
        bedrooms: property.features?.bedrooms && property.features.bedrooms > 0 ? `${property.features.bedrooms}` : "Sem quartos",
        bathrooms: property.features?.bathrooms && property.features.bathrooms > 0 ? `${property.features.bathrooms}` : "Sem banheiros",
        builtArea: builtArea && builtArea > 0 ? `${builtArea} m²` : "Sem área",
        totalArea: property.total_area && property.total_area > 0 ? `${property.total_area} m² total` : null,
        hasBedrooms: Boolean(property.features?.bedrooms && property.features.bedrooms > 0),
        hasBathrooms: Boolean(property.features?.bathrooms && property.features.bathrooms > 0),
        hasBuiltArea: Boolean(builtArea && builtArea > 0),
        hasTotalArea: Boolean(property.total_area && property.total_area > 0),
    }
}

export function propertyResponsibleSummary(property: Pick<PropertyListRow, "broker">) {
    const responsibleName = property.broker?.full_name?.trim()

    return responsibleName
        ? {
            label: responsibleName,
            className: "text-foreground",
            missing: false,
        }
        : {
            label: "Sem responsável",
            className: "text-amber-700",
            missing: true,
        }
}

export function propertyOwnerSummary(property: Pick<PropertyListRow, "owner_contact">) {
    const ownerName = property.owner_contact?.name?.trim()
    const ownerId = property.owner_contact?.id?.trim()

    return ownerName
        ? {
            label: ownerName,
            className: "text-foreground",
            missing: false,
            href: ownerId ? `/contacts/${ownerId}` : null,
        }
        : {
            label: "Sem proprietário",
            className: "text-muted-foreground italic",
            missing: true,
            href: null,
        }
}

export function canOpenPropertyOnSite(
    property: Pick<PropertyListRow, "status">,
    hideFromSite?: boolean | null
) {
    return !hideFromSite && property.status === "available"
}

export function propertySiteVisibilityBadge(
    property: Pick<PropertyListRow, "status">,
    hideFromSite?: boolean | null
) {
    const visible = canOpenPropertyOnSite(property, hideFromSite)

    return {
        label: visible ? "Exibição no site: ativa" : "Exibição no site: oculta",
        className: visible
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : "bg-white/90 text-muted-foreground",
        visible,
    }
}

export function getOperationalIssuePreview(issues: PropertyOperationalIssue[], limit = 2) {
    return {
        visibleIssues: issues.slice(0, limit),
        hiddenCount: Math.max(issues.length - limit, 0),
    }
}

export function propertyShowcaseSummary(property: PropertyListRow) {
    const vitrine = getPropertyVitrineStatus(property)

    return {
        vitrine,
        readinessBadge: {
            label: vitrine.shortLabel,
            className: vitrine.className,
        },
        hiddenBadge: vitrine.hiddenFromVitrine
            ? {
                label: "Site oculto",
                className: "bg-white/90 text-muted-foreground border-muted-foreground/20",
            }
            : null,
        summaryClassName: vitrine.summaryClassName,
        summaryText: vitrine.helper,
        firstActionIssue: vitrine.firstActionIssue,
        reasonLabels: vitrine.reasonLabels,
    }
}

export function PropertiesGrid({
    properties,
    organizationSlug = null,
}: {
    properties: PropertyListRow[]
    organizationSlug?: string | null
}) {
    if (!properties || properties.length === 0) return null

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
                <PropertyCard key={property.id} property={property} organizationSlug={organizationSlug} />
            ))}
        </div>
    )
}

function PropertyCard({
    property,
    organizationSlug = null,
}: {
    property: PropertyListRow
    organizationSlug?: string | null
}) {
    const [optimisticHideFromSite, setOptimisticHideFromSite] = useState<boolean>(property.hide_from_site ?? false)

    const operational = getPropertyOperationalSnapshot(property)
    const mediaQuality = propertyMediaQuality(property)
    const priceSummary = propertyPriceSummary(property)
    const structureSummary = propertyStructureSummary(property)
    const responsibleSummary = propertyResponsibleSummary(property)
    const ownerSummary = propertyOwnerSummary(property)
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
    const correctionBadgeClass = firstActionIssue?.severity === "critical"
        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"

    return (
        <Card className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
            <Link href={`/properties/${property.id}`} className="block">
                {/* Fixed-height cover area to avoid huge thumbnails on large screens */}
                <div className="relative h-48 w-full bg-muted flex items-center justify-center overflow-hidden">
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
                        <Building2 className="h-10 w-10 text-muted-foreground/50" />
                    )}
                    <div className="absolute top-2 right-2">
                        <Badge
                            variant={property.status === 'available' ? 'default' : 'secondary'}
                            title="Status comercial do imóvel"
                        >
                            {statusLabel(property.status)}
                        </Badge>
                    </div>
                    <div className="absolute top-2 left-2">
                        <div className="flex flex-col items-start gap-1">
                            <Badge
                                variant={optimisticHideFromSite || property.status !== 'available' ? "outline" : "secondary"}
                                className={siteVisibility.className}
                                title="Visibilidade no site público e no feed"
                            >
                                {siteVisibility.label}
                            </Badge>
                            <Badge variant="outline" className="bg-black/70 text-white border-black/30">
                                Capa principal
                            </Badge>
                        </div>
                    </div>
                </div>
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-base line-clamp-1">{property.title}</CardTitle>
                            <CardDescription className="line-clamp-1">
                                <MapPin className="inline h-3 w-3 mr-1" />
                                {property.address?.full_address ||
                                    [property.address?.neighborhood, property.address?.city, property.address?.state]
                                        .filter(Boolean)
                                        .join(" - ") ||
                                    'Endereço não informado'}
                            </CardDescription>
                        </div>
                    </div>
                    <div className={`text-lg font-bold mt-2 ${priceSummary.className}`}>
                        {priceSummary.label}
                    </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-3 p-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{transactionTypeLabel(property.transaction_type)}</Badge>
                        <Badge variant="outline">{purposeLabel(property.purpose)}</Badge>
                        <Badge variant="outline">{propertyTypeLabel(property.type)}</Badge>
                        <Badge variant="outline" className={mediaQuality.className}>
                            {mediaQuality.label}: {mediaQuality.count}
                        </Badge>
                        {property.financing_allowed ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                Aceita financiamento
                            </Badge>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className={`flex items-center gap-1 ${structureSummary.hasBedrooms ? "" : "text-amber-700"}`}>
                            <Bed className="h-3 w-3" />
                            {structureSummary.bedrooms}
                        </div>
                        <div className={`flex items-center gap-1 ${structureSummary.hasBathrooms ? "" : "text-amber-700"}`}>
                            <Bath className="h-3 w-3" />
                            {structureSummary.bathrooms}
                        </div>
                        <div className={`flex items-center gap-1 ${structureSummary.hasBuiltArea ? "" : "text-amber-700"}`}>
                            <AppWindow className="h-3 w-3" />
                            {structureSummary.builtArea}
                        </div>
                        <div className={`flex items-center gap-1 ${structureSummary.hasTotalArea ? "" : "text-muted-foreground/60"}`}>
                            <AppWindow className="h-3 w-3" />
                            {structureSummary.totalArea ?? "Sem área total"}
                        </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="line-clamp-1">
                            <span className="font-medium text-foreground">Responsável:</span>{" "}
                            <span className={responsibleSummary.className}>{responsibleSummary.label}</span>
                        </div>
                        <div className="line-clamp-1">
                            <span className="font-medium text-foreground">Proprietário:</span>{" "}
                            <span className={ownerSummary.href ? "font-medium text-foreground" : ownerSummary.className}>
                                {ownerSummary.label}
                            </span>
                        </div>
                        <div className="line-clamp-1">
                            <Badge variant="outline" className={portalBadge.className}>
                                {portalBadge.label}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className={showcaseSummary.readinessBadge.className}>
                                {showcaseSummary.readinessBadge.label}
                            </Badge>
                            {showcaseSummary.hiddenBadge ? (
                                <Badge variant="outline" className={showcaseSummary.hiddenBadge.className}>
                                    {showcaseSummary.hiddenBadge.label}
                                </Badge>
                            ) : null}
                        </div>
                    </div>
                </CardContent>
            </Link>
            <CardFooter className="p-4 border-t bg-muted/50 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <Badge
                    variant="outline"
                    className={operationalBadgeClass}
                >
                    {operationalLabel}
                </Badge>
                <span className="w-full text-muted-foreground/90">{operational.reasonSummary}</span>
                <span className={`w-full font-medium ${showcaseSummary.summaryClassName}`}>
                    {showcaseSummary.summaryText}
                </span>
                {hasOperationalIssues ? (
                    <div className="flex w-full flex-wrap gap-1">
                        {issuePreview.visibleIssues.map((issue) => (
                            <Badge
                                key={issue.code}
                                variant="outline"
                                className={
                                    issue.severity === "critical"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200"
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
                ) : null}
                {showcaseSummary.reasonLabels.length > 0 ? (
                    <div className="flex w-full flex-wrap gap-1">
                        {showcaseSummary.reasonLabels.map((reason) => (
                            <Badge
                                key={reason.code}
                                variant="outline"
                                className={
                                    reason.severity === "critical"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200"
                                }
                            >
                                {reason.label}
                            </Badge>
                        ))}
                    </div>
                ) : null}
                <div className="flex w-full flex-wrap items-center gap-2">
                    <Link href={`/properties/${property.id}`}>
                        <Badge variant="outline" className="gap-1 px-2 py-1 hover:bg-muted/50">
                            <PencilLine className="h-3 w-3" />
                            Editar
                        </Badge>
                    </Link>
                    {publicUrl && canOpenOnSite ? (
                        <Link href={publicUrl} target="_blank" rel="noreferrer">
                            <Badge variant="outline" className="gap-1 px-2 py-1 hover:bg-muted/50">
                                <Globe className="h-3 w-3" />
                                Abrir no site
                            </Badge>
                        </Link>
                    ) : null}
                    {firstActionIssue ? (
                        <Link href={buildPropertyFixHref(property.id, firstActionIssue.focusFieldId)}>
                            <Badge variant="outline" className={`gap-1 px-2 py-1 ${correctionBadgeClass}`}>
                                Corrigir: {firstActionIssue.label}
                            </Badge>
                        </Link>
                    ) : null}
                </div>
                <div className="w-full sm:w-auto sm:ml-auto">
                    <PropertySiteVisibilityToggle
                        propertyId={property.id}
                        hideFromSite={optimisticHideFromSite}
                        onOptimisticToggle={(newState) => setOptimisticHideFromSite(newState)}
                        onRevertToggle={() => setOptimisticHideFromSite(property.hide_from_site ?? false)}
                    />
                </div>
            </CardFooter>
        </Card>
    )
}
