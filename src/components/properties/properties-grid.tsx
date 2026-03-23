"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, MapPin, Bed, Bath, AppWindow } from "lucide-react"

import { PropertySiteVisibilityToggle } from "@/components/properties/property-site-visibility-toggle"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import { buildPropertyFixHref, getPropertyPublishIssues } from "@/lib/property-publish-readiness"

export type PropertyListRow = {
    id: string
    public_code?: string | null
    external_id?: string | null
    title: string
    description?: string | null
    price?: number | null
    type?: string | null
    transaction_type?: string | null
    purpose?: string | null
    status?: string | null

    owner_contact?: { name: string } | null
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
    if (!type) return "Tipo não informado"
    if (type === "apartment") return "Apartamento"
    if (type === "house") return "Casa"
    if (type === "condominium_house") return "Casa em condomínio"
    if (type === "land") return "Terreno"
    if (type === "commercial") return "Comercial"
    if (type === "commercial_space") return "Salão comercial"
    return type
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
    if (!property.publish_to_portals) return "Portais desativados"

    const enabled = [
        property.publish_zap ? "ZAP" : null,
        property.publish_imovelweb ? "Imovelweb" : null,
        property.publish_olx ? "OLX" : null,
    ].filter(Boolean)

    if (enabled.length === 0) return "Portais habilitados sem canal marcado"

    return `Portais: ${enabled.join(" · ")}`
}

export function PropertiesGrid({ properties }: { properties: PropertyListRow[] }) {
    if (!properties || properties.length === 0) return null

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
            ))}
        </div>
    )
}

function PropertyCard({ property }: { property: PropertyListRow }) {
    const [optimisticHideFromSite, setOptimisticHideFromSite] = useState<boolean>(property.hide_from_site ?? false)

    const issues = getPropertyPublishIssues(property)
    const hasIssues = issues.length > 0
    const issueSummary = issues.map((item) => item.label).join(" · ")
    const firstIssue = issues[0]

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
                        <Badge
                            variant={optimisticHideFromSite || property.status !== 'available' ? "outline" : "secondary"}
                            className={optimisticHideFromSite || property.status !== 'available' ? "bg-white/90" : "bg-emerald-100 text-emerald-800 border-emerald-200"}
                            title="Visibilidade no site público e no feed"
                        >
                            {optimisticHideFromSite || property.status !== 'available' ? "Site: Oculto" : "Site: Publicado"}
                        </Badge>
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
                    <div className="text-lg font-bold text-primary mt-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price || 0)}
                    </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-3 p-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{transactionTypeLabel(property.transaction_type)}</Badge>
                        <Badge variant="outline">{purposeLabel(property.purpose)}</Badge>
                        <Badge variant="outline">{propertyTypeLabel(property.type)}</Badge>
                        {property.financing_allowed ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                Aceita financiamento
                            </Badge>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Bed className="h-3 w-3" />
                            {property.features?.bedrooms || 0} quartos
                        </div>
                        <div className="flex items-center gap-1">
                            <Bath className="h-3 w-3" />
                            {property.features?.bathrooms || 0} banhos
                        </div>
                        <div className="flex items-center gap-1">
                            <AppWindow className="h-3 w-3" />
                            {property.built_area || property.features?.area || 0} m² constr.
                        </div>
                        <div className="flex items-center gap-1">
                            <AppWindow className="h-3 w-3" />
                            {property.total_area || 0} m² total
                        </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                        {property.owner_contact?.name ? (
                            <div className="line-clamp-1">
                                <span className="font-medium text-foreground">Proprietário:</span> {property.owner_contact.name}
                            </div>
                        ) : null}
                        <div className="line-clamp-1">{portalSummary(property)}</div>
                    </div>
                </CardContent>
            </Link>
            <CardFooter className="p-4 border-t bg-muted/50 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <Badge
                    variant={hasIssues ? "outline" : "secondary"}
                    className={hasIssues ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}
                >
                    Publicação: {hasIssues ? "Com pendências" : "Pronto para site/feed"}
                </Badge>
                {hasIssues ? (
                    <span className="w-full text-amber-800">
                        {issueSummary}
                    </span>
                ) : null}
                {hasIssues && firstIssue ? (
                    <Link href={buildPropertyFixHref(property.id, firstIssue.focusFieldId)} className="underline">
                        Corrigir
                    </Link>
                ) : null}
                <span>Ref: {refLabel(property)}</span>
                <span className="w-full sm:w-auto text-muted-foreground/90">
                    {optimisticHideFromSite || property.status !== 'available' ? "Não aparece no site público" : "Aparece no site público"}
                </span>
                <div className="w-full sm:w-auto sm:ml-auto">
                    <PropertySiteVisibilityToggle
                        propertyId={property.id}
                        hideFromSite={property.hide_from_site ?? null}
                        onOptimisticToggle={(newState) => setOptimisticHideFromSite(newState)}
                        onRevertToggle={() => setOptimisticHideFromSite(property.hide_from_site ?? false)}
                    />
                </div>
            </CardFooter>
        </Card>
    )
}
