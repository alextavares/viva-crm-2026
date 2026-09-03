import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { PropertyFilters } from '@/components/properties/property-filters'
import { PropertiesDisplay } from '@/components/properties/properties-display'
import type { PropertyListRow } from '@/components/properties/properties-grid'
import {
    getPropertyOperationalSnapshot,
    type PropertyOperationalStatus,
    type PropertyOperationalIssueCode,
} from '@/lib/property-operational-readiness'
import { getPropertyVitrineStatus } from '@/lib/property-vitrine-status'
import { buildPropertySearchOrTerms } from '@/lib/property-search-query'
import { getPropertyTypeLabel } from '@/lib/types'

type SiteReadinessFilter = 'all' | 'ready' | 'blocked'

type PropertyQueryRow = {
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
    hide_from_site?: boolean | null
    assigned_to?: string | null
    built_area?: number | null
    total_area?: number | null
    financing_allowed?: boolean | null
    publish_to_portals?: boolean | null
    publish_zap?: boolean | null
    publish_imovelweb?: boolean | null
    publish_olx?: boolean | null
    owner_contact_id?: string | null
    owner_name?: string | null
    owner_contact?: {
        id?: string | null
        name?: string | null
    } | null
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
    broker_profile?: {
        full_name?: string | null
    } | null
}

function normalizeLocationFilterValue(value?: string | null) {
    return value?.trim().toLocaleLowerCase('pt-BR') ?? ''
}

function buildPropertiesHref(
    currentParams: { [key: string]: string | string[] | undefined },
    overrides: Record<string, string | null>
) {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(currentParams)) {
        if (Array.isArray(value)) {
            if (value[0]) params.set(key, value[0])
        } else if (typeof value === "string" && value.length > 0) {
            params.set(key, value)
        }
    }

    for (const [key, value] of Object.entries(overrides)) {
        if (!value || value === "all") {
            params.delete(key)
        } else {
            params.set(key, value)
        }
    }

    params.set("page", "1")

    const qs = params.toString()
    return qs ? `/properties?${qs}` : "/properties"
}

function buildSearchParamKey(currentParams: { [key: string]: string | string[] | undefined }) {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(currentParams)) {
        if (Array.isArray(value)) {
            if (value[0]) params.set(key, value[0])
        } else if (typeof value === "string" && value.length > 0) {
            params.set(key, value)
        }
    }

    return params.toString()
}

const ISSUE_FILTER_OPTIONS: Array<{
    code: PropertyOperationalIssueCode
    label: string
}> = [
    { code: 'missing_price', label: 'Sem preço' },
    { code: 'missing_area', label: 'Sem área' },
    { code: 'missing_bedrooms', label: 'Sem quartos' },
    { code: 'missing_bathrooms', label: 'Sem banheiros' },
    { code: 'missing_images', label: 'Sem fotos' },
    { code: 'few_images', label: 'Galeria fraca' },
    { code: 'missing_neighborhood', label: 'Sem bairro' },
    { code: 'missing_description', label: 'Sem descrição' },
    { code: 'weak_description', label: 'Descrição fraca' },
    { code: 'weak_title', label: 'Título fraco' },
    { code: 'missing_responsible', label: 'Sem responsável' },
    { code: 'missing_type', label: 'Sem tipo' },
]

const OPERATIONAL_STATUS_LABELS: Record<PropertyOperationalStatus, string> = {
    draft: 'Rascunho',
    publishable: 'Publicável',
    published_low_quality: 'Publicado com baixa qualidade',
    published_high_quality: 'Publicado com alta qualidade',
}

function formatPropertyTypeSummary(type?: string | null) {
    return getPropertyTypeLabel(type)
}

function formatCommercialStatusSummary(status?: string | null) {
    if (status === 'available') return 'Disponível'
    if (status === 'inactive') return 'Inativo'
    if (status === 'pending_approval') return 'Aguardando aprovação'
    if (status === 'sold') return 'Vendido'
    if (status === 'rented') return 'Alugado'
    return status ?? 'Indefinido'
}

function formatCurrencySummary(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(value)
}

function needsCommercialEnrichment(snapshot: ReturnType<typeof getPropertyOperationalSnapshot>) {
    return [...snapshot.criticalIssues, ...snapshot.lightIssues].some((issue) =>
        issue.code === 'weak_title' ||
        issue.code === 'missing_description' ||
        issue.code === 'weak_description' ||
        issue.code === 'missing_images' ||
        issue.code === 'few_images'
    )
}

function matchesSiteReadinessFilter(property: PropertyListRow, filter: SiteReadinessFilter) {
    if (filter === 'all') return true

    const vitrine = getPropertyVitrineStatus(property)
    if (filter === 'ready') {
        return vitrine.status === 'ready_hidden'
    }

    return vitrine.status === 'blocked_visible' || vitrine.status === 'blocked_hidden'
}

function mapPropertyRow(row: PropertyQueryRow): PropertyListRow {
    const linkedOwnerName = row.owner_contact?.name?.trim() || null
    const legacyOwnerName = row.owner_name?.trim() || null

    return {
        id: row.id,
        public_code: row.public_code ?? null,
        external_id: row.external_id ?? null,
        assigned_to: row.assigned_to ?? null,
        title: row.title,
        description: row.description ?? null,
        price: row.price ?? null,
        type: row.type ?? null,
        transaction_type: row.transaction_type ?? null,
        purpose: row.purpose ?? null,
        status: row.status ?? null,
        owner_contact: linkedOwnerName
            ? {
                id: row.owner_contact?.id ?? row.owner_contact_id ?? null,
                name: linkedOwnerName,
            }
            : legacyOwnerName
                ? {
                    id: null,
                    name: legacyOwnerName,
                }
                : null,
        broker: row.broker_profile?.full_name
            ? {
                full_name: row.broker_profile.full_name,
            }
            : null,
        hide_from_site: row.hide_from_site ?? null,
        financing_allowed: row.financing_allowed ?? null,
        publish_to_portals: row.publish_to_portals ?? null,
        publish_zap: row.publish_zap ?? null,
        publish_imovelweb: row.publish_imovelweb ?? null,
        publish_olx: row.publish_olx ?? null,
        built_area: row.built_area ?? null,
        total_area: row.total_area ?? null,
        images: row.images ?? null,
        image_paths: row.image_paths ?? null,
        address: row.address ?? null,
        features: row.features ?? null,
    }
}

const OPERATIONAL_STATUS_PRIORITY: Record<PropertyOperationalStatus, number> = {
    draft: 0,
    publishable: 1,
    published_low_quality: 2,
    published_high_quality: 3,
}

function sortPropertiesByOperationalPriority(properties: PropertyListRow[]) {
    return properties
        .map((property) => ({
            property,
            snapshot: getPropertyOperationalSnapshot(property),
        }))
        .sort((left, right) => {
            const statusDelta =
                OPERATIONAL_STATUS_PRIORITY[left.snapshot.status] -
                OPERATIONAL_STATUS_PRIORITY[right.snapshot.status]

            if (statusDelta !== 0) return statusDelta

            const criticalDelta =
                right.snapshot.criticalIssues.length - left.snapshot.criticalIssues.length
            if (criticalDelta !== 0) return criticalDelta

            const lightDelta = right.snapshot.lightIssues.length - left.snapshot.lightIssues.length
            if (lightDelta !== 0) return lightDelta

            const leftCode = left.property.public_code ?? left.property.external_id ?? left.property.id
            const rightCode = right.property.public_code ?? right.property.external_id ?? right.property.id

            return leftCode.localeCompare(rightCode, "pt-BR", { numeric: true })
        })
        .map((item) => item.property)
}

export default async function PropertiesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const resolvedSearchParams = await searchParams
    const page = Number(resolvedSearchParams?.page) || 1
    const pageSize = Number(resolvedSearchParams?.pageSize) || 12
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const search = resolvedSearchParams?.search as string || ''
    const type = resolvedSearchParams?.type as string || 'all'
    const status = resolvedSearchParams?.status as string || 'all'
    const siteVisibility = resolvedSearchParams?.siteVisibility as string || 'all'
    const publishQuality = resolvedSearchParams?.publishQuality as string || 'all'
    const siteReadiness = resolvedSearchParams?.siteReadiness as SiteReadinessFilter || 'all'
    const operationalStatus = resolvedSearchParams?.operationalStatus as string || 'all'
    const issueFilter = resolvedSearchParams?.issueFilter as string || 'all'
    const qualityQueue = resolvedSearchParams?.qualityQueue as string || 'all'
    const brokerId = resolvedSearchParams?.brokerId as string || 'all'
    const city = resolvedSearchParams?.city as string || 'all'
    const neighborhood = resolvedSearchParams?.neighborhood as string || 'all'
    const minPrice = resolvedSearchParams?.minPrice ? Number(resolvedSearchParams.minPrice) : null
    const maxPrice = resolvedSearchParams?.maxPrice ? Number(resolvedSearchParams.maxPrice) : null

    const hasFilters = search !== '' || type !== 'all' || status !== 'all' || siteVisibility !== 'all' || publishQuality !== 'all' || siteReadiness !== 'all' || operationalStatus !== 'all' || issueFilter !== 'all' || qualityQueue !== 'all' || brokerId !== 'all' || city !== 'all' || neighborhood !== 'all' || minPrice !== null || maxPrice !== null

    const listColumns = [
        'id', 'public_code', 'external_id', 'title', 'description',
        'price', 'type', 'transaction_type', 'purpose', 'status', 'hide_from_site', 'assigned_to',
        'built_area', 'total_area', 'financing_allowed',
        'publish_to_portals', 'publish_zap', 'publish_imovelweb', 'publish_olx',
        'owner_contact_id', 'owner_name', 'owner_contact:contacts!properties_owner_contact_id_fkey(id,name)', 'images', 'image_paths', 'address', 'features',
        'broker_profile:profiles(full_name)',
    ].join(',')
    const operationalCountColumns = [
        'id', 'public_code', 'external_id', 'title', 'description',
        'price', 'type', 'transaction_type', 'status', 'hide_from_site', 'assigned_to',
        'publish_to_portals', 'publish_zap', 'publish_imovelweb', 'publish_olx',
        'owner_contact_id', 'owner_name', 'owner_contact:contacts!properties_owner_contact_id_fkey(id,name)', 'images', 'image_paths', 'address', 'features',
    ].join(',')

    let query = supabase
        .from('properties')
        .select(listColumns, { count: 'exact' })
        .order('created_at', { ascending: false })

    if (search) {
        const ors = buildPropertySearchOrTerms(String(search))
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

    if (brokerId !== 'all') {
        query = query.eq('assigned_to', brokerId)
    }

    if (siteVisibility === 'hidden') {
        query = query.eq('hide_from_site', true)
    } else if (siteVisibility === 'published') {
        query = query.or('hide_from_site.is.null,hide_from_site.eq.false')
    }

    if (minPrice !== null) {
        query = query.gte('price', minPrice)
    }

    if (maxPrice !== null) {
        query = query.lte('price', maxPrice)
    }

    let rows: PropertyQueryRow[] = []
    let displayProperties: PropertyListRow[] = []
    let selectableProperties: PropertyListRow[] = []
    let count = 0
    let error: unknown = null

    if (publishQuality === 'pending' || siteReadiness !== 'all' || operationalStatus !== 'all' || issueFilter !== 'all' || qualityQueue !== 'all' || city !== 'all' || neighborhood !== 'all') {
        const pendingQuery = supabase
            .from('properties')
            .select(listColumns)
            .order('created_at', { ascending: false })

        if (type !== 'all') pendingQuery.eq('type', type)
        if (status !== 'all') pendingQuery.eq('status', status)
        if (brokerId !== 'all') pendingQuery.eq('assigned_to', brokerId)
        if (siteVisibility === 'hidden') pendingQuery.eq('hide_from_site', true)
        else if (siteVisibility === 'published') pendingQuery.or('hide_from_site.is.null,hide_from_site.eq.false')
        if (search) {
            const ors = buildPropertySearchOrTerms(String(search))
            if (ors.length > 0) {
                pendingQuery.or(ors.join(","))
            }
        }
        if (minPrice !== null) pendingQuery.gte('price', minPrice)
        if (maxPrice !== null) pendingQuery.lte('price', maxPrice)

        const pendingResult = await pendingQuery.limit(2000)
        error = pendingResult.error
        const queriedRows = (pendingResult.data as PropertyQueryRow[] | null) ?? []
        const mappedRows = queriedRows.map(mapPropertyRow)
        const derivedRows = mappedRows.filter((property) => {
            const operational = getPropertyOperationalSnapshot(property)
            const hasPendingIssues = operational.criticalIssues.length + operational.lightIssues.length > 0
            const propertyCity = normalizeLocationFilterValue(property.address?.city)
            const propertyNeighborhood = normalizeLocationFilterValue(property.address?.neighborhood)
            if (publishQuality === 'pending' && !hasPendingIssues) {
                return false
            }
            if (!matchesSiteReadinessFilter(property, siteReadiness)) {
                return false
            }
            if (operationalStatus !== 'all' && operational.status !== operationalStatus) {
                return false
            }
            if (issueFilter !== 'all' && ![...operational.criticalIssues, ...operational.lightIssues].some((issue) => issue.code === issueFilter)) {
                return false
            }
            if (qualityQueue === 'commercial_enrichment' && !needsCommercialEnrichment(operational)) {
                return false
            }
            if (city !== 'all' && propertyCity !== normalizeLocationFilterValue(city)) {
                return false
            }
            if (neighborhood !== 'all' && propertyNeighborhood !== normalizeLocationFilterValue(neighborhood)) {
                return false
            }
            return true
        })

        const sortedDerivedRows = sortPropertiesByOperationalPriority(derivedRows)

        count = sortedDerivedRows.length
        selectableProperties = sortedDerivedRows
        displayProperties = sortedDerivedRows.slice(start, end + 1)
    } else {
        const pagedResult = await query.range(start, end)
        error = pagedResult.error
        rows = (pagedResult.data as PropertyQueryRow[] | null) ?? []
        count = pagedResult.count ?? 0
    }

    if (error) {
        console.error('Error fetching properties:', {
            message: (error as unknown as { message?: string }).message,
            details: (error as unknown as { details?: string }).details,
            hint: (error as unknown as { hint?: string }).hint,
            code: (error as unknown as { code?: string }).code,
        })
        throw new Error(
            `Não foi possível carregar imóveis: ${
                (error as unknown as { message?: string }).message ?? 'erro desconhecido'
            }`
        )
    }

    const properties = displayProperties.length > 0
        ? displayProperties
        : sortPropertiesByOperationalPriority(rows.map(mapPropertyRow))
    const totalPages = Math.ceil((count || 0) / pageSize)
    const operationalCountQuery = supabase
        .from('properties')
        .select(operationalCountColumns)
        .order('created_at', { ascending: false })

    if (search) {
        const ors = buildPropertySearchOrTerms(String(search))
        if (ors.length > 0) {
            operationalCountQuery.or(ors.join(","))
        }
    }

    if (type !== 'all') operationalCountQuery.eq('type', type)
    if (status !== 'all') operationalCountQuery.eq('status', status)
    if (brokerId !== 'all') operationalCountQuery.eq('assigned_to', brokerId)
    if (siteVisibility === 'hidden') operationalCountQuery.eq('hide_from_site', true)
    else if (siteVisibility === 'published') operationalCountQuery.or('hide_from_site.is.null,hide_from_site.eq.false')
    if (minPrice !== null) operationalCountQuery.gte('price', minPrice)
    if (maxPrice !== null) operationalCountQuery.lte('price', maxPrice)

    const { data: brokers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'broker')
        .order('full_name')

    const { data: profile } = user
        ? await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single()
        : { data: null }

    const { data: organization } = profile?.organization_id
        ? await supabase
            .from('organizations')
            .select('slug')
            .eq('id', profile.organization_id)
            .single()
        : { data: null }

    const organizationSlug = organization?.slug ?? null

    const operationalCountResult = await operationalCountQuery.limit(2000)
    const operationalCountRows = ((operationalCountResult.data as PropertyQueryRow[] | null) ?? []).map(mapPropertyRow)
    if (selectableProperties.length === 0) {
        selectableProperties = sortPropertiesByOperationalPriority(operationalCountRows)
    }
    const cityOptions = Array.from(
        new Set(
            operationalCountRows
                .map((property) => property.address?.city?.trim())
                .filter((value): value is string => Boolean(value))
        )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const neighborhoodOptions = Array.from(
        new Set(
            operationalCountRows
                .filter((property) => city === 'all' || normalizeLocationFilterValue(property.address?.city) === normalizeLocationFilterValue(city))
                .map((property) => property.address?.neighborhood?.trim())
                .filter((value): value is string => Boolean(value))
        )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const locationFilteredOperationalRows = operationalCountRows.filter((property) => {
        const propertyCity = normalizeLocationFilterValue(property.address?.city)
        const propertyNeighborhood = normalizeLocationFilterValue(property.address?.neighborhood)
        if (city !== 'all' && propertyCity !== normalizeLocationFilterValue(city)) {
            return false
        }
        if (neighborhood !== 'all' && propertyNeighborhood !== normalizeLocationFilterValue(neighborhood)) {
            return false
        }
        return true
    })

    const operationalBaseRows = publishQuality === 'pending'
        ? locationFilteredOperationalRows.filter((property) => {
            const snapshot = getPropertyOperationalSnapshot(property)
            return snapshot.criticalIssues.length + snapshot.lightIssues.length > 0
        })
        : locationFilteredOperationalRows
    const operationalSnapshots = operationalBaseRows.map((property) => ({
        property,
        snapshot: getPropertyOperationalSnapshot(property),
        vitrine: getPropertyVitrineStatus(property),
    }))
    const operationalCounts: Record<PropertyOperationalStatus, number> = {
        draft: 0,
        publishable: 0,
        published_low_quality: 0,
        published_high_quality: 0,
    }
    const siteReadinessCounts = {
        ready: 0,
        blocked: 0,
    }
    let siteVisibleCount = 0

    for (const item of operationalSnapshots) {
        operationalCounts[item.snapshot.status] += 1
        if (item.vitrine.status === 'ready_hidden') {
            siteReadinessCounts.ready += 1
        }
        if (item.vitrine.status === 'blocked_visible' || item.vitrine.status === 'blocked_hidden') {
            siteReadinessCounts.blocked += 1
        }
        if (item.vitrine.status === 'live') {
            siteVisibleCount += 1
        }
    }

    const issueCounts: Record<PropertyOperationalIssueCode, number> = {
        missing_type: 0,
        missing_transaction_type: 0,
        missing_price: 0,
        missing_area: 0,
        missing_bedrooms: 0,
        missing_bathrooms: 0,
        missing_city: 0,
        missing_neighborhood: 0,
        missing_responsible: 0,
        weak_title: 0,
        missing_description: 0,
        missing_images: 0,
        few_images: 0,
        weak_description: 0,
    }

    for (const item of operationalSnapshots) {
        const seen = new Set<PropertyOperationalIssueCode>()
        for (const issue of [...item.snapshot.criticalIssues, ...item.snapshot.lightIssues]) {
            if (seen.has(issue.code)) continue
            seen.add(issue.code)
            issueCounts[issue.code] += 1
        }
    }

    const quickIssueFilters = ISSUE_FILTER_OPTIONS
        .map((option) => ({
            ...option,
            count: issueCounts[option.code],
        }))
        .filter((option) => option.count > 0)
    const orderedQuickIssueFilters = [...quickIssueFilters].sort((left, right) => {
        if (left.code === issueFilter) return -1
        if (right.code === issueFilter) return 1
        return right.count - left.count
    })
    const visibleQuickIssueFilters = orderedQuickIssueFilters.slice(0, 6)
    const hiddenQuickIssueFiltersCount = Math.max(orderedQuickIssueFilters.length - visibleQuickIssueFilters.length, 0)

    const commercialEnrichmentCount = operationalSnapshots.filter(({ snapshot }) =>
        needsCommercialEnrichment(snapshot)
    ).length

    const operationalQueues: Array<{
        key: string
        label: string
        description: string
        count: number
        href: string
        active: boolean
        className: string
    }> = [
        {
            key: 'queue_showcase_ready',
            label: 'Prontos para liberar no site',
            description: 'Disponíveis, sem bloqueios e ainda ocultos do site',
            count: siteReadinessCounts.ready,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: 'ready',
                issueFilter: null,
                operationalStatus: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: siteReadiness === 'ready',
            className: 'border-emerald-200 bg-emerald-50',
        },
        {
            key: 'queue_showcase_blocked',
            label: 'Bloqueados na vitrine',
            description: 'Preço, foto, título ou descrição ainda seguram a exibição',
            count: siteReadinessCounts.blocked,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: 'blocked',
                issueFilter: null,
                operationalStatus: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: siteReadiness === 'blocked',
            className: 'border-red-200 bg-red-50',
        },
        {
            key: 'queue_publishable',
            label: 'Cadastro publicável',
            description: 'Cadastro consistente, mas não necessariamente liberável na vitrine agora',
            count: operationalCounts.publishable,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: null,
                operationalStatus: 'publishable',
                issueFilter: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: operationalStatus === 'publishable' && issueFilter === 'all',
            className: 'border-sky-200 bg-sky-50',
        },
        {
            key: 'queue_commercial_enrichment',
            label: 'Enriquecimento comercial',
            description: 'Título, descrição ou galeria precisam de reforço',
            count: commercialEnrichmentCount,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: null,
                qualityQueue: 'commercial_enrichment',
                issueFilter: null,
                operationalStatus: null,
                publishQuality: null,
            }),
            active: qualityQueue === 'commercial_enrichment',
            className: 'border-fuchsia-200 bg-fuchsia-50',
        },
        {
            key: 'queue_missing_images',
            label: 'Sem fotos',
            description: 'Imóveis sem imagem para publicação',
            count: issueCounts.missing_images,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: null,
                issueFilter: 'missing_images',
                operationalStatus: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: issueFilter === 'missing_images',
            className: 'border-amber-200 bg-amber-50',
        },
        {
            key: 'queue_few_images',
            label: 'Galeria fraca',
            description: 'Poucas fotos para performar bem na vitrine',
            count: issueCounts.few_images,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: null,
                issueFilter: 'few_images',
                operationalStatus: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: issueFilter === 'few_images',
            className: 'border-amber-200 bg-amber-50',
        },
        {
            key: 'queue_missing_neighborhood',
            label: 'Sem bairro',
            description: 'Localização incompleta para busca e portal',
            count: issueCounts.missing_neighborhood,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: null,
                issueFilter: 'missing_neighborhood',
                operationalStatus: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: issueFilter === 'missing_neighborhood',
            className: 'border-amber-200 bg-amber-50',
        },
        {
            key: 'queue_low_quality',
            label: 'Publicados com pendências',
            description: 'Já publicados, mas ainda com baixa qualidade',
            count: operationalCounts.published_low_quality,
            href: buildPropertiesHref(resolvedSearchParams, {
                siteReadiness: null,
                operationalStatus: 'published_low_quality',
                issueFilter: null,
                qualityQueue: null,
                publishQuality: null,
            }),
            active: operationalStatus === 'published_low_quality' && issueFilter === 'all',
            className: 'border-rose-200 bg-rose-50',
        },
    ].filter((queue) => queue.count > 0)

    const brokerOperationalLoads = brokerId === 'all'
        ? Array.from(
            operationalSnapshots.reduce((acc, item) => {
                const responsibleId = item.property.assigned_to ?? 'unassigned'
                const responsibleName = item.property.broker?.full_name?.trim() || 'Sem responsável de fato'
                const current = acc.get(responsibleId) ?? {
                    id: responsibleId,
                    name: responsibleName,
                    pendingCount: 0,
                    draftCount: 0,
                    lowQualityCount: 0,
                    commercialEnrichmentCount: 0,
                    totalCount: 0,
                }

                current.totalCount += 1
                if (item.snapshot.criticalIssues.length + item.snapshot.lightIssues.length > 0) {
                    current.pendingCount += 1
                }
                if (item.snapshot.status === 'draft') {
                    current.draftCount += 1
                }
                if (item.snapshot.status === 'published_low_quality') {
                    current.lowQualityCount += 1
                }
                if (needsCommercialEnrichment(item.snapshot)) {
                    current.commercialEnrichmentCount += 1
                }

                acc.set(responsibleId, current)
                return acc
            }, new Map<string, {
                id: string
                name: string
                pendingCount: number
                draftCount: number
                lowQualityCount: number
                commercialEnrichmentCount: number
                totalCount: number
            }>())
        )
            .map(([, value]) => value)
            .filter((value) => value.pendingCount > 0)
            .sort((a, b) => {
                if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount
                return a.name.localeCompare(b.name, 'pt-BR')
            })
            .slice(0, 6)
        : []

    const operationalCards: Array<{
        key: 'all' | PropertyOperationalStatus
        label: string
        count: number
        description: string
        className: string
    }> = [
        {
            key: 'all',
            label: 'Todos',
            count: operationalBaseRows.length,
            description: publishQuality === 'pending' ? 'Com pendências nos filtros atuais' : 'Imóveis nos filtros atuais',
            className: 'border-border bg-card',
        },
        { key: 'draft', label: 'Rascunho', count: operationalCounts.draft, description: 'Faltam dados essenciais', className: 'border-slate-200 bg-slate-50' },
        { key: 'publishable', label: 'Publicável', count: operationalCounts.publishable, description: 'Cadastro consistente, mas ainda depende do fluxo comercial e do site', className: 'border-sky-200 bg-sky-50' },
        { key: 'published_low_quality', label: 'Publicado com baixa qualidade', count: operationalCounts.published_low_quality, description: 'Publicado, mas com pendências', className: 'border-amber-200 bg-amber-50' },
        { key: 'published_high_quality', label: 'Publicado com alta qualidade', count: operationalCounts.published_high_quality, description: 'Publicado sem pendências', className: 'border-emerald-200 bg-emerald-50' },
    ]
    const activeFilterSummary = [
        search ? `Busca: ${search}` : null,
        type !== 'all' ? `Tipo: ${formatPropertyTypeSummary(type)}` : null,
        status !== 'all' ? `Status: ${formatCommercialStatusSummary(status)}` : null,
        siteVisibility !== 'all'
            ? `Exibição no site: ${siteVisibility === 'published' ? 'ativa' : 'oculta'}`
            : null,
        publishQuality === 'pending' ? 'Qualidade: com pendências' : null,
        siteReadiness === 'ready'
            ? 'Publicação: pronto para publicar'
            : siteReadiness === 'blocked'
                ? 'Publicação: com pendências'
                : null,
        operationalStatus !== 'all' ? `Operacional: ${OPERATIONAL_STATUS_LABELS[operationalStatus as PropertyOperationalStatus]}` : null,
        issueFilter !== 'all'
            ? `Pendência: ${ISSUE_FILTER_OPTIONS.find((option) => option.code === issueFilter)?.label ?? issueFilter}`
            : null,
        qualityQueue === 'commercial_enrichment' ? 'Fila: Enriquecimento comercial' : null,
        brokerId !== 'all'
            ? `Responsável: ${
                brokerId === 'unassigned'
                    ? 'Sem responsável'
                    : brokers?.find((broker) => broker.id === brokerId)?.full_name?.trim() || 'Responsável filtrado'
            }`
            : null,
        city !== 'all' ? `Cidade: ${city}` : null,
        neighborhood !== 'all' ? `Bairro: ${neighborhood}` : null,
        minPrice !== null ? `Preço mín.: ${formatCurrencySummary(minPrice)}` : null,
        maxPrice !== null ? `Preço máx.: ${formatCurrencySummary(maxPrice)}` : null,
    ].filter((item): item is string => Boolean(item))
    const diagnosticSectionOpen =
        operationalStatus !== 'all' ||
        issueFilter !== 'all' ||
        qualityQueue === 'commercial_enrichment' ||
        publishQuality === 'pending' ||
        siteReadiness !== 'all' ||
        brokerId !== 'all'

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <div className="space-y-4">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold md:text-2xl">Imóveis</h1>
                    <p className="text-muted-foreground">Gerencie seus imóveis e anúncios.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
                    <Button asChild variant="outline" className="w-full xl:w-auto">
                        <Link href="/properties/import">Importar</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full xl:w-auto">
                        <Link href="/properties/publish">Publicar em massa</Link>
                    </Button>
                    <Button asChild className="w-full sm:col-span-2 xl:w-auto">
                        <Link href="/properties/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Imóvel
                        </Link>
                    </Button>
                    {organizationSlug ? (
                        <Button asChild variant="outline" className="w-full sm:col-span-2 xl:w-auto">
                            <Link href={`/s/${organizationSlug}`} target="_blank" rel="noreferrer">
                                Ver vitrine pública
                            </Link>
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">Resumo da vitrine</div>
                        <div className="text-xs text-muted-foreground">
                            Veja rápido o que já está publicado, o que pode subir agora e o que ainda trava a publicação.
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                                Publicados no site: {siteVisibleCount}
                            </Badge>
                            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
                                Prontos para publicar: {siteReadinessCounts.ready}
                            </Badge>
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                Com pendências: {siteReadinessCounts.blocked}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={buildPropertiesHref(resolvedSearchParams, {
                                    siteReadiness: 'ready',
                                    issueFilter: null,
                                    operationalStatus: null,
                                    qualityQueue: null,
                                    publishQuality: null,
                                })}
                            >
                                Ver prontos para publicar
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={buildPropertiesHref(resolvedSearchParams, {
                                    siteReadiness: 'blocked',
                                    issueFilter: null,
                                    operationalStatus: null,
                                    qualityQueue: null,
                                    publishQuality: null,
                                })}
                            >
                                Revisar pendências
                            </Link>
                        </Button>
                        {organizationSlug ? (
                            <Button asChild size="sm">
                                <Link href={`/s/${organizationSlug}`} target="_blank" rel="noreferrer">
                                    Conferir vitrine
                                </Link>
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <details className="rounded-lg border bg-card" open={activeFilterSummary.length > 0}>
                <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-medium text-foreground">Filtros e recortes da carteira</div>
                            <div className="text-xs text-muted-foreground">
                                Abra só quando precisar refinar a lista ou salvar um recorte operacional.
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                            {activeFilterSummary.length > 0 ? `${activeFilterSummary.length} filtro(s) ativo(s)` : "Lista aberta primeiro"}
                        </Badge>
                    </div>
                </summary>
                <div className="border-t p-4">
                    <PropertyFilters
                        key={buildSearchParamKey(resolvedSearchParams)}
                        brokers={brokers ?? []}
                        cities={cityOptions}
                        neighborhoods={neighborhoodOptions}
                    />
                </div>
            </details>

            {activeFilterSummary.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/20 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="text-xs font-medium text-foreground">Recorte ativo</span>
                    {activeFilterSummary.map((item) => (
                        <Badge key={item} variant="outline" className="text-[10px]">
                            {item}
                        </Badge>
                    ))}
                    <Link href="/properties" className="sm:ml-auto">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            Limpar recorte
                        </Button>
                    </Link>
                </div>
            ) : null}

            {properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg bg-muted/20 border-dashed">
                    <Building2 className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Nenhum imóvel encontrado</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        {hasFilters
                            ? 'Nenhum imóvel corresponde ao recorte atual. Ajuste ou limpe os filtros para voltar a ver oportunidades.'
                            : 'Nenhum imóvel encontrado para esta página ou filtros.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {hasFilters ? (
                            <Link href="/properties">
                                <Button variant="outline">Limpar filtros</Button>
                            </Link>
                        ) : null}
                        {count === 0 && !hasFilters ? (
                            <Link href="/properties/new">
                                <Button variant="outline">Cadastrar Primeiro Imóvel</Button>
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : (
                <>
                    <PropertiesDisplay
                        properties={properties}
                        allSelectableProperties={selectableProperties}
                        organizationSlug={organizationSlug}
                        brokers={brokers ?? []}
                    />

                    {totalPages > 1 ? (
                        <div className="flex items-center justify-end gap-2 mt-4">
                            <Link href={buildPropertiesHref(resolvedSearchParams, { page: String(page - 1) })} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                                <Button variant="outline" size="sm" disabled={page <= 1}>Anterior</Button>
                            </Link>
                            <span className="text-sm text-muted-foreground">
                                Página {page} de {totalPages}
                            </span>
                            <Link href={buildPropertiesHref(resolvedSearchParams, { page: String(page + 1) })} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
                                <Button variant="outline" size="sm" disabled={page >= totalPages}>Próxima</Button>
                            </Link>
                        </div>
                    ) : null}
                </>
            )}

            <details open={diagnosticSectionOpen} className="rounded-lg border bg-card p-4 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    Diagnóstico da carteira
                </summary>
                <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                        {operationalCards.map((card) => {
                            const isActive = operationalStatus === card.key || (operationalStatus === 'all' && card.key === 'all')

                            return (
                                <Link
                                    key={card.key}
                                    href={buildPropertiesHref(resolvedSearchParams, {
                                        siteReadiness: null,
                                        operationalStatus: card.key === 'all' ? null : card.key,
                                        issueFilter: null,
                                        qualityQueue: null,
                                    })}
                                    className={`min-w-0 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 ${card.className} ${isActive ? 'ring-2 ring-primary/30 border-primary/50' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium text-foreground">{card.label}</div>
                                            <div className="text-xs text-muted-foreground">{card.description}</div>
                                        </div>
                                        <div className="text-2xl font-semibold text-foreground">{card.count}</div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>

                    {operationalQueues.length > 0 ? (
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Filas operacionais
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Mantivemos aqui só as filas mais acionáveis. As demais pendências continuam nos filtros rápidos.
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {operationalQueues.map((queue) => (
                                    <Link
                                        key={queue.key}
                                        href={queue.href}
                                        className={`min-w-0 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 ${queue.className} ${queue.active ? 'ring-2 ring-primary/30 border-primary/50' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-foreground">{queue.label}</div>
                                                <div className="text-xs text-muted-foreground">{queue.description}</div>
                                            </div>
                                            <div className="text-2xl font-semibold text-foreground">{queue.count}</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {brokerOperationalLoads.length > 0 ? (
                        <div className="space-y-2">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Gargalos por responsável
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {brokerOperationalLoads.map((load) => (
                                    <Link
                                        key={load.id}
                                        href={buildPropertiesHref(resolvedSearchParams, {
                                            siteReadiness: null,
                                            brokerId: load.id === 'unassigned' ? null : load.id,
                                            qualityQueue: load.commercialEnrichmentCount > 0 ? 'commercial_enrichment' : null,
                                            publishQuality: load.commercialEnrichmentCount > 0 ? null : 'pending',
                                            issueFilter: load.id === 'unassigned' ? 'missing_responsible' : null,
                                            operationalStatus: null,
                                        })}
                                        className="min-w-0 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium text-foreground">{load.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {load.pendingCount} imóvel(is) com pendência
                                                    </div>
                                                </div>
                                                <div className="text-2xl font-semibold text-foreground">
                                                    {load.pendingCount}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                                <Badge variant="outline" className="text-[10px]">
                                                    Rascunhos: {load.draftCount}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    Publicados fracos: {load.lowQualityCount}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    Comercial: {load.commercialEnrichmentCount}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    Total no recorte: {load.totalCount}
                                                </Badge>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {quickIssueFilters.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={buildPropertiesHref(resolvedSearchParams, {
                                        siteReadiness: null,
                                        issueFilter: null,
                                        operationalStatus: null,
                                        qualityQueue: null,
                                    })}
                                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs transition-colors ${issueFilter === 'all' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted/30'}`}
                                >
                                    Todas as pendências
                                </Link>
                                {visibleQuickIssueFilters.map((option) => (
                                    <Link
                                        key={option.code}
                                        href={buildPropertiesHref(resolvedSearchParams, {
                                            siteReadiness: null,
                                            issueFilter: option.code,
                                            operationalStatus: null,
                                            qualityQueue: null,
                                        })}
                                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${issueFilter === option.code ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-border bg-background hover:bg-muted/30'}`}
                                    >
                                        <span>{option.label}</span>
                                        <Badge variant="outline" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                                            {option.count}
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                            {hiddenQuickIssueFiltersCount > 0 ? (
                                <div className="text-xs text-muted-foreground">
                                    +{hiddenQuickIssueFiltersCount} pendência(s) continuam disponíveis nas filas e no filtro detalhado.
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Status comercial</span> indica se o imóvel pode entrar no mercado.
                        {" "}
                        <span className="font-medium text-foreground">Exibir no site</span> mostra só o controle manual da vitrine própria.
                        {" "}
                        <span className="font-medium text-foreground">Curadoria da vitrine</span> mostra o estado final: ao vivo, pronto, bloqueado ou fora da vitrine.
                        {" "}
                        <span className="font-medium text-foreground">Portais</span> indica se a distribuição externa está desligada, pronta ou com canal faltando.
                    </div>
                </div>
            </details>
        </div>
    )
}
