'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Home, Loader2 } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'
import { getPropertyTypeLabel } from '@/lib/types'

type ContactProfile = {
    interest_type?: string | null
    interest_bedrooms?: number | null
    interest_price_max?: number | null
    city?: string | null
}

type PropertyMatchRow = Pick<
    Tables<'properties'>,
    'id' | 'title' | 'public_code' | 'type' | 'transaction_type' | 'price' | 'status' | 'organization_id'
> & {
    address: Tables<'properties'>['address']
    features: Tables<'properties'>['features']
}

type MatchedProperty = {
    id: string
    title: string | null
    public_code: string | null
    type: string | null
    transaction_type: string | null
    city: string | null
    neighborhood: string | null
    price: number | null
    bedrooms: number | null
    score: number
}

function getAddressPart(address: Tables<'properties'>['address'], key: 'city' | 'neighborhood') {
    if (!address || typeof address !== 'object') return null
    const value = (address as Record<string, unknown>)[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getBedrooms(): number | null {
    // CANONICAL CONTRACT GAP: `properties.features` is a free-text array with
    // no structured bedroom count, so bedroom matching is unavailable.
    return null
}

function normalizeMatchRow(property: PropertyMatchRow): Omit<MatchedProperty, 'score'> {
    return {
        id: property.id,
        title: property.title,
        public_code: property.public_code,
        type: property.type,
        transaction_type: property.transaction_type,
        city: getAddressPart(property.address, 'city'),
        neighborhood: getAddressPart(property.address, 'neighborhood'),
        price: property.price,
        bedrooms: getBedrooms(),
    }
}

function computeScore(property: Omit<MatchedProperty, 'score'>, profile: ContactProfile): number {
    let score = 0

    if (profile.interest_type && property.type === profile.interest_type) score += 35

    if (profile.interest_bedrooms != null && property.bedrooms != null) {
        const diff = Math.abs(property.bedrooms - profile.interest_bedrooms)
        if (diff === 0) score += 25
        else if (diff === 1) score += 10
    }

    if (profile.interest_price_max && property.price && property.price > 0) {
        if (property.price <= profile.interest_price_max) score += 25
        else if (property.price <= profile.interest_price_max * 1.1) score += 10
    }

    if (profile.city && property.city?.toLowerCase() === profile.city.toLowerCase()) score += 15

    return Math.min(score, 100)
}

function formatCurrency(value: number | null | undefined) {
    if (!value) return '—'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(value)
}

function transactionLabel(transactionType: string | null) {
    if (transactionType === 'rent') return 'Locação'
    if (transactionType === 'seasonal') return 'Temporada'
    return 'Venda'
}

interface Props {
    contactId: string
    organizationId: string
    contactProfile: ContactProfile
}

export function PropertyMatchSheet({ contactId, organizationId, contactProfile }: Props) {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [matches, setMatches] = useState<MatchedProperty[]>([])
    const [loading, setLoading] = useState(false)

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen)
        if (nextOpen) {
            setLoading(true)
        }
    }

    useEffect(() => {
        if (!open) return

        let active = true

        const fetchMatches = async () => {
            let query = supabase
                .from('properties')
                .select('id, title, public_code, type, transaction_type, price, address, features, status, organization_id')
                .eq('organization_id', organizationId)
                .eq('status', 'available')
                .limit(200)

            if (contactProfile.interest_type) {
                query = query.eq('type', contactProfile.interest_type)
            }

            const { data } = await query

            if (!active) return

            if (!data) {
                setMatches([])
                setLoading(false)
                return
            }

            const normalized = (data as PropertyMatchRow[]).map((property) => normalizeMatchRow(property))

            const filteredByCity = contactProfile.city
                ? normalized.filter((property) => property.city?.toLowerCase() === contactProfile.city?.toLowerCase())
                : normalized

            const scored = filteredByCity
                .map((property) => ({ ...property, score: computeScore(property, contactProfile) }))
                .filter((property) => property.score >= 20)
                .sort((a, b) => b.score - a.score)
                .slice(0, 20)

            setMatches(scored)
            setLoading(false)
        }

        void fetchMatches()

        return () => {
            active = false
        }
    }, [open, supabase, organizationId, contactProfile])

    const hasProfile =
        Boolean(contactProfile.interest_type) ||
        typeof contactProfile.interest_bedrooms === 'number' ||
        Boolean(contactProfile.interest_price_max) ||
        Boolean(contactProfile.city)

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" aria-label={`Buscar imóveis compatíveis para o contato ${contactId}`}>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar imóveis compatíveis
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[420px] overflow-y-auto sm:w-[520px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" />
                        Matching de Imóveis
                    </SheetTitle>
                </SheetHeader>

                {!hasProfile ? (
                    <div className="mt-4 rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        Este contato ainda não tem perfil de interesse suficiente. Preencha cidade, tipo, quartos ou preço máximo para melhorar o matching.
                    </div>
                ) : null}

                {loading ? (
                    <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Buscando imóveis compatíveis...
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {matches.length === 0 ? (
                            <div className="rounded-md border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                                Nenhum imóvel compatível encontrado com o perfil atual.
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-muted-foreground">{matches.length} imóveis compatíveis encontrados</p>
                                {matches.map((property) => (
                                    <div key={property.id} className="space-y-1.5 rounded-lg border bg-card p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{property.title || '(sem título)'}</p>
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {property.public_code || property.id.slice(0, 8)}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                                                    property.score >= 70
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : property.score >= 40
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                }`}
                                            >
                                                {property.score}%
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 text-xs">
                                            <Badge variant="outline">{getPropertyTypeLabel(property.type)}</Badge>
                                            <Badge variant="outline">{transactionLabel(property.transaction_type)}</Badge>
                                            {property.bedrooms != null ? (
                                                <Badge variant="outline">{property.bedrooms} dorm.</Badge>
                                            ) : null}
                                            <Badge variant="secondary">{formatCurrency(property.price)}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {[property.neighborhood, property.city].filter(Boolean).join(', ')}
                                        </p>
                                        <Button variant="outline" size="sm" className="h-7 w-full text-xs" asChild>
                                            <Link href={`/properties/${property.id}`} target="_blank" rel="noopener noreferrer">
                                                Ver imóvel
                                            </Link>
                                        </Button>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
