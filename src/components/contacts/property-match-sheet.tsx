'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Home, Loader2 } from 'lucide-react'

type ContactProfile = {
    interest_type?: string | null
    interest_bedrooms?: number | null
    interest_price_max?: number | null
    interest_neighborhoods?: string[] | null
    city?: string | null
}

type MatchedProperty = {
    id: string
    title: string | null
    code: string | null
    type: string | null
    transaction_type: string | null
    city: string | null
    neighborhood: string | null
    sale_price: number | null
    rent_price: number | null
    bedrooms: number | null
    score: number
}

function computeScore(property: Omit<MatchedProperty, 'score'>, profile: ContactProfile): number {
    let score = 0
    if (profile.interest_type && property.type === profile.interest_type) score += 30
    if (profile.interest_bedrooms !== null && property.bedrooms !== null) {
        const diff = Math.abs((property.bedrooms ?? 0) - (profile.interest_bedrooms ?? 0))
        if (diff === 0) score += 25
        else if (diff === 1) score += 10
    }
    const price = property.sale_price ?? property.rent_price ?? 0
    if (profile.interest_price_max && price > 0 && price <= profile.interest_price_max) score += 25
    if (profile.city && property.city?.toLowerCase() === profile.city.toLowerCase()) score += 10
    const interestNeighborhoods = (profile.interest_neighborhoods ?? []) as string[]
    if (
        interestNeighborhoods.length > 0 &&
        property.neighborhood &&
        interestNeighborhoods.some((n) => n.toLowerCase() === property.neighborhood!.toLowerCase())
    ) {
        score += 10
    }
    return Math.min(score, 100)
}

function formatCurrency(value: number | null | undefined) {
    if (!value) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

interface Props {
    contactId: string
    contactProfile: ContactProfile
}

export function PropertyMatchSheet({ contactId, contactProfile }: Props) {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [matches, setMatches] = useState<MatchedProperty[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        setLoading(true)

        const fetchMatches = async () => {
            let query = supabase
                .from('properties')
                .select('id, title, code, type, transaction_type, city, neighborhood, sale_price, rent_price, bedrooms')
                .eq('status', 'available')
                .limit(100)

            if (contactProfile.interest_type) {
                query = query.eq('type', contactProfile.interest_type)
            }
            if (contactProfile.city) {
                query = query.ilike('city', `%${contactProfile.city}%`)
            }
            if (contactProfile.interest_price_max) {
                query = query.lte('sale_price', contactProfile.interest_price_max)
            }

            const { data } = await query
            if (!data) { setLoading(false); return }

            const scored: MatchedProperty[] = data
                .map((p: any) => ({ ...p, score: computeScore(p, contactProfile) }))
                .filter((p: any) => p.score >= 20)
                .sort((a: any, b: any) => b.score - a.score)
                .slice(0, 20)

            setMatches(scored)
            setLoading(false)
        }

        fetchMatches()
    }, [open, supabase, contactProfile])

    const hasProfile = contactProfile.interest_type || contactProfile.interest_price_max || contactProfile.city

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                    <Search className="mr-2 h-4 w-4" />
                    Buscar imóvel ideal
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" />
                        Matching de Imóveis
                    </SheetTitle>
                </SheetHeader>

                {!hasProfile && (
                    <div className="mt-4 rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        ⚠️ Este contato não tem perfil de interesse preenchido. Preencha tipo, cidade e preço máximo para melhores resultados.
                    </div>
                )}

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
                                {matches.map((p) => (
                                    <div key={p.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{p.title || '(sem título)'}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{p.code || ''}</p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${p.score >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                                p.score >= 40 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {p.score}%
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 text-xs">
                                            <Badge variant="outline">{p.type}</Badge>
                                            {p.bedrooms != null && (
                                                <Badge variant="outline">{p.bedrooms} dorm.</Badge>
                                            )}
                                            <Badge variant="secondary">
                                                {formatCurrency(p.sale_price ?? p.rent_price)}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {[p.neighborhood, p.city].filter(Boolean).join(', ')}
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-7 text-xs"
                                            asChild
                                        >
                                            <a href={`/properties/${p.id}`} target="_blank" rel="noopener noreferrer">
                                                Ver imóvel
                                            </a>
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

