'use client'

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search, Star, Trash2, X } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { PROPERTY_TYPE_OPTIONS } from "@/lib/types"

type BrokerFilterOption = {
    id: string
    full_name: string | null
}

type PropertyFiltersProps = {
    brokers?: BrokerFilterOption[]
    cities?: string[]
    neighborhoods?: string[]
}

type PropertyFilterPreset = {
    id: string
    name: string
    filters: Record<string, string>
}

const PROPERTY_FILTER_PRESETS_KEY = "property_operational_filter_presets_v1"

const BUILT_IN_PRESETS: Array<{
    id: string
    name: string
    filters: Record<string, string>
}> = [
    {
        id: "preset_showcase_ready",
        name: "Prontos para publicar",
        filters: { siteReadiness: "ready" },
    },
    {
        id: "preset_showcase_blocked",
        name: "Com pendências de publicação",
        filters: { siteReadiness: "blocked" },
    },
    {
        id: "preset_drafts",
        name: "Rascunhos",
        filters: { operationalStatus: "draft" },
    },
    {
        id: "preset_publishable",
        name: "Cadastro publicável",
        filters: { operationalStatus: "publishable" },
    },
    {
        id: "preset_low_quality",
        name: "Publicados com pendências",
        filters: { operationalStatus: "published_low_quality" },
    },
    {
        id: "preset_commercial_enrichment",
        name: "Enriquecimento comercial",
        filters: { qualityQueue: "commercial_enrichment" },
    },
    {
        id: "preset_missing_images",
        name: "Sem fotos",
        filters: { issueFilter: "missing_images" },
    },
    {
        id: "preset_few_images",
        name: "Galeria fraca",
        filters: { issueFilter: "few_images" },
    },
    {
        id: "preset_weak_title",
        name: "Título fraco",
        filters: { issueFilter: "weak_title" },
    },
    {
        id: "preset_weak_description",
        name: "Descrição fraca",
        filters: { issueFilter: "weak_description" },
    },
    {
        id: "preset_missing_price",
        name: "Sem preço",
        filters: { issueFilter: "missing_price" },
    },
    {
        id: "preset_missing_responsible",
        name: "Sem responsável",
        filters: { issueFilter: "missing_responsible" },
    },
]

export function PropertyFilters({
    brokers = [],
    cities = [],
    neighborhoods = [],
}: PropertyFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const urlSearch = searchParams.get('search') || ''
    const urlType = searchParams.get('type') || 'all'
    const urlStatus = searchParams.get('status') || 'all'
    const urlSiteVisibility = searchParams.get('siteVisibility') || 'all'
    const urlPublishQuality = searchParams.get('publishQuality') || 'all'
    const urlSiteReadiness = searchParams.get('siteReadiness') || 'all'
    const urlOperationalStatus = searchParams.get('operationalStatus') || 'all'
    const urlIssueFilter = searchParams.get('issueFilter') || 'all'
    const urlQualityQueue = searchParams.get('qualityQueue') || 'all'
    const urlBrokerId = searchParams.get('brokerId') || 'all'
    const urlCity = searchParams.get('city') || 'all'
    const urlNeighborhood = searchParams.get('neighborhood') || 'all'
    const urlMinPrice = searchParams.get('minPrice') || ''
    const urlMaxPrice = searchParams.get('maxPrice') || ''
    const hasActiveFilters = [
        urlSearch,
        urlType !== 'all' ? urlType : '',
        urlStatus !== 'all' ? urlStatus : '',
        urlSiteVisibility !== 'all' ? urlSiteVisibility : '',
        urlPublishQuality !== 'all' ? urlPublishQuality : '',
        urlSiteReadiness !== 'all' ? urlSiteReadiness : '',
        urlOperationalStatus !== 'all' ? urlOperationalStatus : '',
        urlIssueFilter !== 'all' ? urlIssueFilter : '',
        urlQualityQueue !== 'all' ? urlQualityQueue : '',
        urlBrokerId !== 'all' ? urlBrokerId : '',
        urlCity !== 'all' ? urlCity : '',
        urlNeighborhood !== 'all' ? urlNeighborhood : '',
        urlMinPrice,
        urlMaxPrice,
    ].some(Boolean)

    // Initialize state from URL params
    const [search, setSearch] = useState(urlSearch)
    const [type, setType] = useState(urlType)
    const [status, setStatus] = useState(urlStatus)
    const [siteVisibility, setSiteVisibility] = useState(urlSiteVisibility)
    const [publishQuality, setPublishQuality] = useState(urlPublishQuality)
    const [operationalStatus, setOperationalStatus] = useState(urlOperationalStatus)
    const [issueFilter, setIssueFilter] = useState(urlIssueFilter)
    const [brokerId, setBrokerId] = useState(urlBrokerId)
    const [city, setCity] = useState(urlCity)
    const [neighborhood, setNeighborhood] = useState(urlNeighborhood)
    const [minPrice, setMinPrice] = useState(urlMinPrice)
    const [maxPrice, setMaxPrice] = useState(urlMaxPrice)
    const [savedPresets, setSavedPresets] = useState<PropertyFilterPreset[]>(() => {
        if (typeof window === "undefined") return []
        try {
            const stored = window.localStorage.getItem(PROPERTY_FILTER_PRESETS_KEY)
            if (!stored) return []
            const parsed = JSON.parse(stored) as PropertyFilterPreset[]
            return Array.isArray(parsed) ? parsed : []
        } catch (error) {
            console.error("Error loading property filter presets:", error)
            return []
        }
    })

    const debouncedSearch = useDebounce(search, 500)
    const debouncedMinPrice = useDebounce(minPrice, 500)
    const debouncedMaxPrice = useDebounce(maxPrice, 500)

    const createQueryString = useCallback(
        (params: Record<string, string | null>) => {
            const newSearchParams = new URLSearchParams(searchParams.toString())

            for (const [key, value] of Object.entries(params)) {
                if (value === null || value === '' || value === 'all') {
                    newSearchParams.delete(key)
                } else {
                    newSearchParams.set(key, value)
                }
            }

            // Reset page on filter change
            newSearchParams.set('page', '1')

            return newSearchParams.toString()
        },
        [searchParams]
    )

    const createExactQueryString = useCallback((params: Record<string, string>) => {
        const newSearchParams = new URLSearchParams()

        for (const [key, value] of Object.entries(params)) {
            if (value && value !== 'all') {
                newSearchParams.set(key, value)
            }
        }

        newSearchParams.set('page', '1')
        return newSearchParams.toString()
    }, [])

    const getCurrentFilterState = useCallback(() => {
        const current: Record<string, string> = {}
        if (search.trim()) current.search = search.trim()
        if (type !== 'all') current.type = type
        if (status !== 'all') current.status = status
        if (siteVisibility !== 'all') current.siteVisibility = siteVisibility
        if (publishQuality !== 'all') current.publishQuality = publishQuality
        if (urlSiteReadiness !== 'all') current.siteReadiness = urlSiteReadiness
        if (operationalStatus !== 'all') current.operationalStatus = operationalStatus
        if (issueFilter !== 'all') current.issueFilter = issueFilter
        if (urlQualityQueue !== 'all') current.qualityQueue = urlQualityQueue
        if (brokerId !== 'all') current.brokerId = brokerId
        if (city !== 'all') current.city = city
        if (neighborhood !== 'all') current.neighborhood = neighborhood
        if (minPrice.trim()) current.minPrice = minPrice.trim()
        if (maxPrice.trim()) current.maxPrice = maxPrice.trim()
        return current
    }, [
        brokerId,
        city,
        issueFilter,
        maxPrice,
        minPrice,
        neighborhood,
        operationalStatus,
        publishQuality,
        search,
        siteVisibility,
        status,
        type,
        urlSiteReadiness,
        urlQualityQueue,
    ])

    const applyPreset = useCallback((filters: Record<string, string>) => {
        router.replace(`?${createExactQueryString(filters)}`)
    }, [createExactQueryString, router])

    const saveCurrentPreset = () => {
        if (typeof window === "undefined") return
        const currentFilters = getCurrentFilterState()
        if (Object.keys(currentFilters).length === 0) {
            return
        }

        const name = window.prompt("Nome do preset operacional")
        if (!name?.trim()) return

        const nextPreset: PropertyFilterPreset = {
            id: crypto.randomUUID(),
            name: name.trim(),
            filters: currentFilters,
        }

        const nextPresets = [nextPreset, ...savedPresets].slice(0, 8)
        setSavedPresets(nextPresets)
        window.localStorage.setItem(PROPERTY_FILTER_PRESETS_KEY, JSON.stringify(nextPresets))
    }

    const deletePreset = (presetId: string) => {
        if (typeof window === "undefined") return
        const nextPresets = savedPresets.filter((preset) => preset.id !== presetId)
        setSavedPresets(nextPresets)
        window.localStorage.setItem(PROPERTY_FILTER_PRESETS_KEY, JSON.stringify(nextPresets))
    }

    // Effect for debounced values
    useEffect(() => {
        router.replace(`?${createQueryString({
            search: debouncedSearch,
            minPrice: debouncedMinPrice,
            maxPrice: debouncedMaxPrice
        })}`)
    }, [debouncedSearch, debouncedMinPrice, debouncedMaxPrice, createQueryString, router])

    // Handlers for immediate filters
    const handleTypeChange = (value: string) => {
        setType(value)
        router.replace(`?${createQueryString({ type: value })}`)
    }

    const handleStatusChange = (value: string) => {
        setStatus(value)
        router.replace(`?${createQueryString({ status: value })}`)
    }

    const handleSiteVisibilityChange = (value: string) => {
        setSiteVisibility(value)
        router.replace(`?${createQueryString({ siteVisibility: value })}`)
    }

    const handlePublishQualityChange = (value: string) => {
        setPublishQuality(value)
        router.replace(`?${createQueryString({ publishQuality: value })}`)
    }

    const handleOperationalStatusChange = (value: string) => {
        setOperationalStatus(value)
        router.replace(`?${createQueryString({ operationalStatus: value })}`)
    }

    const handleBrokerChange = (value: string) => {
        setBrokerId(value)
        router.replace(`?${createQueryString({ brokerId: value })}`)
    }

    const handleCityChange = (value: string) => {
        setCity(value)
        setNeighborhood('all')
        router.replace(`?${createQueryString({ city: value, neighborhood: null })}`)
    }

    const handleNeighborhoodChange = (value: string) => {
        setNeighborhood(value)
        router.replace(`?${createQueryString({ neighborhood: value })}`)
    }

    const clearFilters = () => {
        setSearch('')
        setType('all')
        setStatus('all')
        setSiteVisibility('all')
        setPublishQuality('all')
        setOperationalStatus('all')
        setIssueFilter('all')
        setBrokerId('all')
        setCity('all')
        setNeighborhood('all')
        setMinPrice('')
        setMaxPrice('')
        router.replace('?')
    }

    return (
        <div className="mb-6 space-y-4 rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="relative md:col-span-2 xl:col-span-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título, referência, bairro ou descrição..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <Select value={type} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                            <SelectItem key={propertyType.value} value={propertyType.value}>
                                {propertyType.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="sold">Vendido</SelectItem>
                        <SelectItem value="rented">Alugado</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={siteVisibility} onValueChange={handleSiteVisibilityChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Exibição no site" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Exibição no site: Todos</SelectItem>
                        <SelectItem value="published">Exibição no site: Ligada</SelectItem>
                        <SelectItem value="hidden">Exibição no site: Desligada</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={publishQuality} onValueChange={handlePublishQualityChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Qualidade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Qualidade: Todos</SelectItem>
                        <SelectItem value="pending">Qualidade: Com pendências</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={operationalStatus} onValueChange={handleOperationalStatusChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Operacional" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Operacional: Todos</SelectItem>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="publishable">Publicável</SelectItem>
                        <SelectItem value="published_low_quality">Publicado com baixa qualidade</SelectItem>
                        <SelectItem value="published_high_quality">Publicado com alta qualidade</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                <Select value={brokerId} onValueChange={handleBrokerChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Responsável: Todos</SelectItem>
                        {brokers.map((broker) => (
                            <SelectItem key={broker.id} value={broker.id}>
                                {broker.full_name || broker.id}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={city} onValueChange={handleCityChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Cidade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Cidade: Todas</SelectItem>
                        {cities.map((cityOption) => (
                            <SelectItem key={cityOption} value={cityOption}>
                                {cityOption}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={neighborhood} onValueChange={handleNeighborhoodChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Bairro" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Bairro: Todos</SelectItem>
                        {neighborhoods.map((neighborhoodOption) => (
                            <SelectItem key={neighborhoodOption} value={neighborhoodOption}>
                                {neighborhoodOption}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Input
                    type="number"
                    placeholder="Preço Mín."
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                />
                <Input
                    type="number"
                    placeholder="Preço Máx."
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                    {hasActiveFilters
                        ? "Ajuste o recorte para organizar sua carteira sem perder a lista de vista."
                        : "Use os filtros para separar publicação, responsável e pendências sem apertar a listagem."}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
                >
                    <X className="mr-2 h-4 w-4" />
                    Limpar filtros
                </Button>
            </div>

            <details className="rounded-lg border border-dashed bg-muted/10 p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                    Recortes rápidos e salvos
                </summary>
                <div className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Use os recortes prontos quando quiser revisar bloqueios, publicação ou pendências recorrentes.
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={saveCurrentPreset} className="w-full sm:w-auto">
                            <Star className="mr-2 h-3.5 w-3.5" />
                            Salvar recorte atual
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {BUILT_IN_PRESETS.map((preset) => {
                            const isActive = Object.entries(preset.filters).every(
                                ([key, value]) => searchParams.get(key) === value
                            ) && Object.keys(preset.filters).length > 0

                            return (
                                <Button
                                    key={preset.id}
                                    type="button"
                                    variant={isActive ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => applyPreset(preset.filters)}
                                >
                                    {preset.name}
                                </Button>
                            )
                        })}
                        {savedPresets.map((preset) => {
                            const isActive = Object.entries(preset.filters).every(
                                ([key, value]) => searchParams.get(key) === value
                            ) && Object.keys(preset.filters).length > 0

                            return (
                                <div
                                    key={preset.id}
                                    className={`inline-flex items-center rounded-md border ${isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
                                >
                                    <button
                                        type="button"
                                        className="px-3 py-1.5 text-sm"
                                        onClick={() => applyPreset(preset.filters)}
                                    >
                                        {preset.name}
                                    </button>
                                    <button
                                        type="button"
                                        className="border-l px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                        onClick={() => deletePreset(preset.id)}
                                        aria-label={`Excluir preset ${preset.name}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </details>
        </div>
    )
}
