import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Building2, MapPin, Bed, Bath, AppWindow } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PropertyFilters } from '@/components/properties/property-filters'
import { PropertySiteVisibilityToggle } from '@/components/properties/property-site-visibility-toggle'

function isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
}

function sanitizeForOrIlike(v: string) {
    // PostgREST `or()` uses comma-separated expressions, so avoid commas/parentheses/wildcards.
    return v.replace(/[,%()]/g, " ").trim()
}

function refLabel(property: { id?: string | null; external_id?: string | null }) {
    const ext = typeof property.external_id === "string" ? property.external_id : ""
    if (ext) {
        const last = ext.split(":").pop()
        if (last) return last
        return ext
    }
    return typeof property?.id === "string" ? property.id.slice(0, 8) : "-"
}

export default async function PropertiesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createClient()
    const resolvedSearchParams = await searchParams
    const page = Number(resolvedSearchParams?.page) || 1
    const pageSize = Number(resolvedSearchParams?.pageSize) || 12
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const search = resolvedSearchParams?.search as string || ''
    const type = resolvedSearchParams?.type as string || 'all'
    const status = resolvedSearchParams?.status as string || 'all'
    const minPrice = resolvedSearchParams?.minPrice ? Number(resolvedSearchParams.minPrice) : null
    const maxPrice = resolvedSearchParams?.maxPrice ? Number(resolvedSearchParams.maxPrice) : null

    let query = supabase
        .from('properties')
        // Keep the select simple; relationship embedding can fail if the FK is missing/misconfigured
        // in the remote DB. The list UI doesn't currently display broker name anyway.
        .select(`*`, { count: 'exact' })
        .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
        const raw = String(search).trim()
        const s = sanitizeForOrIlike(raw)
        const digits = s.replace(/[^0-9]/g, "")

        const ors = []
        if (s) {
            ors.push(`title.ilike.%${s}%`)
            ors.push(`external_id.ilike.%${s}%`)
        }
        if (digits && digits !== s) {
            ors.push(`external_id.ilike.%${digits}%`)
        }
        if (isUuid(raw)) {
            ors.push(`id.eq.${raw}`)
        }

        if (ors.length > 0) {
            query = query.or(ors.join(","))
        }
    }

    if (type !== 'all') {
        query = query.eq('type', type)
    }

    if (status !== 'all') {
        query = query.eq('status', status)
    }

    if (minPrice !== null) {
        query = query.gte('price', minPrice)
    }

    if (maxPrice !== null) {
        query = query.lte('price', maxPrice)
    }

    // Apply pagination
    const { data: properties, count, error } = await query
        .range(start, end)

    if (error) {
        console.error('Error fetching properties:', {
            message: (error as unknown as { message?: string }).message,
            details: (error as unknown as { details?: string }).details,
            hint: (error as unknown as { hint?: string }).hint,
            code: (error as unknown as { code?: string }).code,
        })
    }

    const totalPages = Math.ceil((count || 0) / pageSize)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold md:text-2xl">Imóveis</h1>
                    <p className="text-muted-foreground">Gerencie seus imóveis e anúncios.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Link href="/properties/import">
                        <Button variant="outline" className="w-full sm:w-auto">Importar</Button>
                    </Link>
                    <Link href="/properties/publish">
                        <Button variant="outline" className="w-full sm:w-auto">Publicar em massa</Button>
                    </Link>
                    <Link href="/properties/new">
                        <Button className="w-full sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Imóvel
                        </Button>
                    </Link>
                </div>
            </div>

            <PropertyFilters />

            {(!properties || properties.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg bg-muted/20 border-dashed">
                    <Building2 className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Nenhum imóvel encontrado</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        Nenhum imóvel encontrado para esta página ou filtros.
                    </p>
                    {count === 0 && (
                        <Link href="/properties/new">
                            <Button variant="outline">Cadastrar Primeiro Imóvel</Button>
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {properties.map((property) => (
                            <Card key={property.id} className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                                <Link href={`/properties/${property.id}`} className="block">
                                    {/* Fixed-height cover area to avoid huge thumbnails on large screens */}
                                    <div className="relative h-48 w-full bg-muted flex items-center justify-center overflow-hidden">
                                        {property.images && property.images.length > 0 ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={property.images[0]}
                                                alt={property.title}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <Building2 className="h-10 w-10 text-muted-foreground/50" />
                                        )}
                                        <div className="absolute top-2 right-2">
                                            <Badge variant={property.status === 'available' ? 'default' : 'secondary'}>
                                                {property.status === 'available' ? 'Disponível' : property.status}
                                            </Badge>
                                        </div>
                                        {property.hide_from_site ? (
                                            <div className="absolute top-2 left-2">
                                                <Badge variant="outline" className="bg-white/90">
                                                    Oculto do site
                                                </Badge>
                                            </div>
                                        ) : null}
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
                                    <CardContent className="p-4 pt-0 grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-auto">
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
                                            {property.features?.area || 0} m²
                                        </div>
                                    </CardContent>
                                </Link>
                                <CardFooter className="p-4 border-t bg-muted/50 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                                    <span>{property.type === 'apartment' ? 'Apartamento' : property.type === 'house' ? 'Casa' : property.type}</span>
                                    <span>Ref: {refLabel(property)}</span>
                                    <div className="w-full sm:w-auto sm:ml-auto">
                                        <PropertySiteVisibilityToggle propertyId={property.id} hideFromSite={property.hide_from_site} />
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-end gap-2 mt-4">
                            <Link href={`/properties?page=${page - 1}&pageSize=${pageSize}&search=${search}&type=${type}&status=${status}&minPrice=${minPrice || ''}&maxPrice=${maxPrice || ''}`} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                                <Button variant="outline" size="sm" disabled={page <= 1}>Anterior</Button>
                            </Link>
                            <span className="text-sm text-muted-foreground">
                                Página {page} de {totalPages}
                            </span>
                            <Link href={`/properties?page=${page + 1}&pageSize=${pageSize}&search=${search}&type=${type}&status=${status}&minPrice=${minPrice || ''}&maxPrice=${maxPrice || ''}`} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
                                <Button variant="outline" size="sm" disabled={page >= totalPages}>Próxima</Button>
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
