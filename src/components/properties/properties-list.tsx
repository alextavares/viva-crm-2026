"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Building2, AppWindow, Bed, Bath, AlertCircle, ExternalLink } from "lucide-react"

import { PropertySiteVisibilityToggle } from "@/components/properties/property-site-visibility-toggle"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import { buildPropertyFixHref, getPropertyPublishIssues } from "@/lib/property-publish-readiness"
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
    portalSummary
} from "@/components/properties/properties-grid"
import { Button } from "@/components/ui/button"

export function PropertiesList({ properties }: { properties: PropertyListRow[] }) {
    if (!properties || properties.length === 0) return null

    return (
        <div className="rounded-md border bg-card overflow-hidden">
            <div className="relative w-full overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[300px]">Imóvel</TableHead>
                            <TableHead>Valores</TableHead>
                            <TableHead>Mídia & Sistema</TableHead>
                            <TableHead>Proprietário</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {properties.map((property) => (
                            <PropertyRow key={property.id} property={property} />
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function PropertyRow({ property }: { property: PropertyListRow }) {
    const [optimisticHideFromSite, setOptimisticHideFromSite] = useState<boolean>(property.hide_from_site ?? false)

    const issues = getPropertyPublishIssues(property)
    const hasIssues = issues.length > 0
    const issueSummary = issues.map((item) => item.label).join(" · ")
    const firstIssue = issues[0]

    return (
        <TableRow className="group">
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
                            {property.features?.bedrooms ? <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {property.features.bedrooms}</span> : null}
                            {property.features?.bathrooms ? <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.features.bathrooms}</span> : null}
                            {property.built_area || property.features?.area ? <span className="flex items-center gap-1"><AppWindow className="h-3 w-3" /> {property.built_area || property.features?.area}</span> : null}
                        </div>
                    </div>
                </div>
            </TableCell>

            {/* Valores e Tipo */}
            <TableCell className="align-top">
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <div className="font-semibold text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price || 0)}
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
                            Financiável
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
                                variant={optimisticHideFromSite ? "outline" : "secondary"}
                                className={`text-[10px] px-1.5 py-0 ${optimisticHideFromSite ? "bg-white/90 text-muted-foreground" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`}
                                title="Visibilidade no site e portais associados"
                            >
                                {optimisticHideFromSite ? "Site Oculto" : "No Site"}
                            </Badge>
                            <PropertySiteVisibilityToggle
                                propertyId={property.id}
                                hideFromSite={property.hide_from_site ?? null}
                                onOptimisticToggle={(newState) => setOptimisticHideFromSite(newState)}
                                onRevertToggle={() => setOptimisticHideFromSite(property.hide_from_site ?? false)}
                            />
                        </div>

                        <div className="text-[10px] font-medium text-muted-foreground line-clamp-1" title={portalSummary(property)}>
                            {portalSummary(property)}
                        </div>
                        
                        {hasIssues ? (
                            <div className="flex items-start gap-1 text-[10px] leading-tight text-amber-600 font-medium">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">
                                    {issueSummary} 
                                    {firstIssue ? (
                                        <Link href={buildPropertyFixHref(property.id, firstIssue.focusFieldId)} className="underline ml-1">Corrigir</Link>
                                    ) : null}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </TableCell>

            {/* Proprietário */}
            <TableCell className="align-top">
                <div className="flex flex-col gap-1 text-sm text-foreground max-w-[180px]">
                    {property.owner_contact?.name ? (
                        <span className="font-medium line-clamp-2" title={property.owner_contact.name}>{property.owner_contact.name}</span>
                    ) : (
                        <span className="text-muted-foreground italic text-xs">Não vinculado</span>
                    )}
                </div>
            </TableCell>

            {/* Ações */}
            <TableCell className="align-top text-right pr-4">
                <Link href={`/properties/${property.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 lg:opacity-0 group-hover:opacity-100 transition-opacity" title="Visualizar ficha">
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </Link>
            </TableCell>
        </TableRow>
    )
}
