"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PropertiesGrid, type PropertyListRow } from "@/components/properties/properties-grid"
import { PropertiesList } from "@/components/properties/properties-list"
import { LayoutGrid, List, Eye, EyeOff, Loader2 } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getPropertyOperationalSnapshot } from "@/lib/property-operational-readiness"
import { toast } from "sonner"
import {
    updateBulkPropertyAssignee,
    updateBulkPropertyCommercialEnrichment,
    updateBulkPropertyPortalPublishing,
    updateBulkPropertySiteVisibility,
} from "@/app/actions/properties"

// Fallback to local storage to remember the user's preference
const PREFERRED_VIEW_KEY = "property_list_view_preference"

type ViewMode = "list" | "grid"

interface PropertiesDisplayProps {
    properties: PropertyListRow[]
    allSelectableProperties?: PropertyListRow[]
    organizationSlug?: string | null
    brokers?: Array<{ id: string; full_name: string | null }>
}

export function PropertiesDisplay({
    properties,
    allSelectableProperties,
    organizationSlug = null,
    brokers = [],
}: PropertiesDisplayProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [bulkSaving, setBulkSaving] = useState<"publish" | "hide" | "assign" | "portal" | "marketing" | null>(null)
    const [bulkBrokerId, setBulkBrokerId] = useState<string>("keep")
    const [bulkPortalAction, setBulkPortalAction] = useState<string>("none")
    const [bulkActionError, setBulkActionError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        const saved = localStorage.getItem(PREFERRED_VIEW_KEY) as ViewMode | null
        if (saved === "grid") {
            setViewMode(saved)
        }
    }, [])

    // Remove selection reset on every data refresh to avoid instability during background re-renders
    /*
    useEffect(() => {
        setSelectedIds([])
    }, [properties])
    */

    useEffect(() => {
        if (selectedIds.length === 0) {
            setBulkBrokerId("keep")
            setBulkPortalAction("none")
        }
    }, [selectedIds])

    const selectableProperties = useMemo(
        () => (allSelectableProperties && allSelectableProperties.length > 0 ? allSelectableProperties : properties),
        [allSelectableProperties, properties]
    )

    const handleViewChange = (value: string) => {
        if (!value) return // Prevent deselecting
        const newMode = value as ViewMode
        setViewMode(newMode)
        localStorage.setItem(PREFERRED_VIEW_KEY, newMode)
    }

    const allSelected =
        selectableProperties.length > 0 && selectableProperties.every((property) => selectedIds.includes(property.id))
    const hasSelection = selectedIds.length > 0
    const selectedProperties = useMemo(
        () => selectableProperties.filter((property) => selectedIds.includes(property.id)),
        [selectableProperties, selectedIds]
    )
    const selectedCommercialEnrichmentProperties = useMemo(
        () =>
            selectedProperties.filter((property) => {
                const snapshot = getPropertyOperationalSnapshot(property)
                return [...snapshot.criticalIssues, ...snapshot.lightIssues].some(
                    (issue) =>
                        issue.code === "weak_title" ||
                        issue.code === "missing_description" ||
                        issue.code === "weak_description"
                )
            }),
        [selectedProperties]
    )

    const toggleSelectOne = (propertyId: string) => {
        setSelectedIds((current) =>
            current.includes(propertyId)
                ? current.filter((id) => id !== propertyId)
                : [...current, propertyId]
        )
    }

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : selectableProperties.map((property) => property.id))
    }

    const applyBulkVisibility = async (hideFromSite: boolean) => {
        if (selectedIds.length === 0 || bulkSaving) return

        setBulkSaving(hideFromSite ? "hide" : "publish")
        setBulkActionError(null)
        try {
            const result = await updateBulkPropertySiteVisibility({
                propertyIds: selectedIds,
                hideFromSite,
            })

            if (!result.success) {
                setBulkActionError(result.error)
                toast.error(result.error)
                return
            }

            toast.success(
                hideFromSite
                    ? `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) ocultado(s) do site.`
                    : `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) publicado(s) no site.`
            )
            setSelectedIds([])
            router.refresh()
        } catch (error) {
            console.error("Bulk property visibility error:", error)
            const message =
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar a visibilidade em lote."
            setBulkActionError(message)
            toast.error(message)
        } finally {
            setBulkSaving(null)
        }
    }

    const applyBulkBroker = async () => {
        if (selectedIds.length === 0 || bulkSaving || bulkBrokerId === "keep") return

        setBulkSaving("assign")
        setBulkActionError(null)
        try {
            const result = await updateBulkPropertyAssignee({
                propertyIds: selectedIds,
                assignedTo: bulkBrokerId === "__unassigned__" ? null : bulkBrokerId,
            })

            if (!result.success) {
                setBulkActionError(result.error)
                toast.error(result.error)
                return
            }

            toast.success(
                bulkBrokerId === "__unassigned__"
                    ? `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) sem responsável.`
                    : `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) com responsável atualizado.`
            )
            setSelectedIds([])
            setBulkBrokerId("keep")
            router.refresh()
        } catch (error) {
            console.error("Bulk property broker assignment error:", error)
            const message =
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar o responsável em lote."
            setBulkActionError(message)
            toast.error(message)
        } finally {
            setBulkSaving(null)
        }
    }

    const applyBulkPortals = async () => {
        if (selectedIds.length === 0 || bulkSaving || bulkPortalAction === "none") return

        setBulkSaving("portal")
        setBulkActionError(null)
        try {
            const result = await updateBulkPropertyPortalPublishing({
                propertyIds: selectedIds,
                action: bulkPortalAction as
                    | "enable_all_portals"
                    | "disable_all_portals"
                    | "enable_imovelweb"
                    | "enable_zap"
                    | "enable_olx",
            })

            if (!result.success) {
                setBulkActionError(result.error)
                toast.error(result.error)
                return
            }

            const successMessage =
                bulkPortalAction === "enable_all_portals"
                    ? `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) com portais ativados.`
                    : bulkPortalAction === "disable_all_portals"
                        ? `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) com portais desativados.`
                        : bulkPortalAction === "enable_imovelweb"
                            ? `Imovelweb ativado em ${result.data?.updatedCount ?? selectedIds.length} imóvel(is).`
                            : bulkPortalAction === "enable_zap"
                                ? `ZAP ativado em ${result.data?.updatedCount ?? selectedIds.length} imóvel(is).`
                                : `OLX ativado em ${result.data?.updatedCount ?? selectedIds.length} imóvel(is).`

            toast.success(successMessage)
            setSelectedIds([])
            setBulkPortalAction("none")
            router.refresh()
        } catch (error) {
            console.error("Bulk property portal action error:", error)
            const message =
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar os portais em lote."
            setBulkActionError(message)
            toast.error(message)
        } finally {
            setBulkSaving(null)
        }
    }

    const applyBulkCommercialEnrichment = async () => {
        if (selectedIds.length === 0 || bulkSaving) return

        if (selectedCommercialEnrichmentProperties.length === 0) {
            toast.message("Nenhum imóvel selecionado precisa de enriquecimento comercial.")
            return
        }

        setBulkSaving("marketing")
        setBulkActionError(null)
        try {
            const result = await updateBulkPropertyCommercialEnrichment({
                propertyIds: selectedIds,
            })

            if (!result.success) {
                setBulkActionError(result.error)
                toast.error(result.error)
                return
            }

            const updatedCount = result.data?.updatedCount ?? 0
            const skippedCount = result.data?.skippedCount ?? 0
            const summary =
                skippedCount > 0
                    ? `${updatedCount} atualizado(s), ${skippedCount} sem ajuste necessário.`
                    : `${updatedCount} imóvel(is) atualizado(s).`

            toast.success(`Enriquecimento comercial aplicado. ${summary}`)
            setSelectedIds([])
            router.refresh()
        } catch (error) {
            console.error("Bulk property marketing enrichment error:", error)
            const message =
                error instanceof Error
                    ? error.message
                    : "Não foi possível aplicar o enriquecimento comercial em lote."
            setBulkActionError(message)
            toast.error(message)
        } finally {
            setBulkSaving(null)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground font-medium">
                    Exibindo <span className="text-foreground">{properties.length}</span> imóveis nesta página
                    {selectableProperties.length !== properties.length ? (
                        <>
                            {" "}· <span className="text-foreground">{selectableProperties.length}</span> no recorte atual
                        </>
                    ) : null}
                </div>
                <ToggleGroup 
                    type="single" 
                    value={viewMode} 
                    onValueChange={handleViewChange}
                    className="w-full justify-start rounded-md border bg-muted/20 p-1 md:w-auto"
                >
                    <ToggleGroupItem value="list" aria-label="Modo lista" className="h-8 px-2 text-xs">
                        <List className="h-4 w-4 mr-1.5" />
                        Lista
                    </ToggleGroupItem>
                    <ToggleGroupItem value="grid" aria-label="Modo cards" className="h-8 px-2 text-xs">
                        <LayoutGrid className="h-4 w-4 mr-1.5" />
                        Cards
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {bulkActionError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {bulkActionError}
                </div>
            ) : null}

            {viewMode === "list" ? (
                <>
                    <div className="rounded-lg border bg-muted/20 px-3 py-3 md:hidden">
                        <div className="text-xs text-muted-foreground">
                            No celular mostramos cards para manter a carteira navegável. A lista completa e as ações em lote continuam melhores no desktop.
                        </div>
                    </div>
                    <div className="hidden rounded-lg border bg-muted/20 px-3 py-3 md:block">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="text-xs text-muted-foreground">
                                {hasSelection
                                    ? `${selectedIds.length} imóvel(is) selecionado(s) no recorte`
                                    : "Selecione imóveis na lista para liberar ações em lote"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={toggleSelectAll}
                                    disabled={selectableProperties.length === 0 || bulkSaving !== null}
                                >
                                    {allSelected
                                        ? "Desmarcar todos"
                                        : selectableProperties.length !== properties.length
                                            ? `Selecionar todos do recorte (${selectableProperties.length})`
                                            : "Selecionar todos"}
                                </Button>
                                {hasSelection && !allSelected ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedIds([])}
                                        disabled={bulkSaving !== null}
                                    >
                                        Limpar seleção
                                    </Button>
                                ) : null}
                            </div>
                        </div>

                        {hasSelection ? (
                            <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => applyBulkVisibility(false)}
                                    disabled={bulkSaving !== null}
                                    className="w-full xl:w-auto"
                                >
                                    {bulkSaving === "publish" ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Eye className="mr-2 h-4 w-4" />
                                    )}
                                    Publicar no site
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyBulkVisibility(true)}
                                    disabled={bulkSaving !== null}
                                    className="w-full xl:w-auto"
                                >
                                    {bulkSaving === "hide" ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <EyeOff className="mr-2 h-4 w-4" />
                                    )}
                                    Ocultar do site
                                </Button>
                                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[260px] lg:flex-row lg:items-center">
                                    <Select value={bulkBrokerId} onValueChange={setBulkBrokerId}>
                                        <SelectTrigger className="h-9 w-full">
                                            <SelectValue placeholder="Atribuir responsável" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="keep">Responsável em lote</SelectItem>
                                            <SelectItem value="__unassigned__">Remover responsável</SelectItem>
                                            {brokers.map((broker) => (
                                                <SelectItem key={broker.id} value={broker.id}>
                                                    {broker.full_name || broker.id}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={applyBulkBroker}
                                        disabled={bulkSaving !== null || bulkBrokerId === "keep"}
                                        className="w-full lg:w-auto"
                                    >
                                        {bulkSaving === "assign" ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Atribuir
                                    </Button>
                                </div>
                                {selectedCommercialEnrichmentProperties.length > 0 ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={applyBulkCommercialEnrichment}
                                        disabled={bulkSaving !== null}
                                        className="w-full xl:w-auto"
                                    >
                                        {bulkSaving === "marketing" ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Enriquecer anúncio ({selectedCommercialEnrichmentProperties.length})
                                    </Button>
                                ) : null}
                                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[280px] lg:flex-row lg:items-center">
                                    <Select value={bulkPortalAction} onValueChange={setBulkPortalAction}>
                                        <SelectTrigger className="h-9 w-full">
                                            <SelectValue placeholder="Ação de portais" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Portais em lote</SelectItem>
                                            <SelectItem value="enable_all_portals">Ativar todos os portais</SelectItem>
                                            <SelectItem value="disable_all_portals">Desativar todos os portais</SelectItem>
                                            <SelectItem value="enable_imovelweb">Ativar Imovelweb</SelectItem>
                                            <SelectItem value="enable_zap">Ativar ZAP</SelectItem>
                                            <SelectItem value="enable_olx">Ativar OLX</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={applyBulkPortals}
                                        disabled={bulkSaving !== null || bulkPortalAction === "none"}
                                        className="w-full lg:w-auto"
                                    >
                                        {bulkSaving === "portal" ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Aplicar
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </>
            ) : (
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Ações em lote estão disponíveis na visualização em lista.
                </div>
            )}

            {viewMode === "list" ? (
                <>
                    <div className="md:hidden">
                        <PropertiesGrid properties={properties} organizationSlug={organizationSlug} />
                    </div>
                    <div className="hidden md:block">
                        <PropertiesList
                            properties={properties}
                            organizationSlug={organizationSlug}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelectOne}
                        />
                    </div>
                </>
            ) : (
                <PropertiesGrid properties={properties} organizationSlug={organizationSlug} />
            )}
        </div>
    )
}
