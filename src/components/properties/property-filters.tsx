'use client'

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"

export function PropertyFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Initialize state from URL params
    const [search, setSearch] = useState(searchParams.get('search') || '')
    const [type, setType] = useState(searchParams.get('type') || 'all')
    const [status, setStatus] = useState(searchParams.get('status') || 'all')
    const [siteVisibility, setSiteVisibility] = useState(searchParams.get('siteVisibility') || 'all')
    const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
    const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')

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

    const clearFilters = () => {
        setSearch('')
        setType('all')
        setStatus('all')
        setSiteVisibility('all')
        setMinPrice('')
        setMaxPrice('')
        router.replace('?')
    }

    return (
        <div className="bg-card p-4 rounded-lg border shadow-sm space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título, descrição, código ou UUID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Type Filter */}
                <Select value={type} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        <SelectItem value="apartment">Apartamento</SelectItem>
                        <SelectItem value="house">Casa</SelectItem>
                        <SelectItem value="land">Terreno</SelectItem>
                        <SelectItem value="commercial">Comercial</SelectItem>
                    </SelectContent>
                </Select>

                {/* Status Filter */}
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

                {/* Site Visibility Filter */}
                <Select value={siteVisibility} onValueChange={handleSiteVisibilityChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Site" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Site: Todos</SelectItem>
                        <SelectItem value="published">Site: Publicados</SelectItem>
                        <SelectItem value="hidden">Site: Ocultos</SelectItem>
                    </SelectContent>
                </Select>

                {/* Price Range */}
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

            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                </Button>
            </div>
        </div>
    )
}
