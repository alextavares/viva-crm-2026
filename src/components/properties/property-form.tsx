'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { ImageUpload } from "@/components/ui/image-upload"
import { PropertyFormSaveBar } from "@/components/properties/property-form-save-bar"
import { PropertyFormStepNav } from "@/components/properties/property-form-step-nav"
import { PropertyOwnerQuickCreate } from "@/components/properties/property-owner-quick-create"
import { toast } from "sonner"
import { saveProperty } from "@/app/actions/properties"
import { createClient } from "@/lib/supabase/client"
import {
    DEFAULT_PROPERTY_TYPE,
    PROPERTY_TYPE_OPTIONS,
    propertySchema,
    type PropertyFormValues,
    type PropertyFeatures,
    type PropertyAddress,
} from "@/lib/types"
import { buildSuggestedPropertyDescription, buildSuggestedPropertyTitle } from "@/lib/property-marketing"
import { getPropertyOperationalSnapshot, getPropertyOperationalStatusLabel } from "@/lib/property-operational-readiness"
import { getPropertyPublishIssues, isPropertyPublishReady } from "@/lib/property-publish-readiness"
import {
    PROPERTY_FORM_STEPS,
    countPropertyIssuesByStep,
    getNextPortalPublicationValues,
    getPropertyFormStepForField,
    type PropertyFormStepId,
} from "@/lib/properties/property-form-steps"

interface PropertyFormProps {
    initialData?: {
        id: string
        title: string
        description?: string
        price: number
        type: string
        transaction_type?: string | null
        assigned_to?: string | null
        status: string
        features: PropertyFeatures
        address: PropertyAddress
        images?: string[]
        image_paths?: string[]
        hide_from_site?: boolean | null
        owner_name?: string | null
        owner_contact_id?: string | null
        publish_to_portals?: boolean | null
        publish_zap?: boolean | null
        publish_imovelweb?: boolean | null
        publish_olx?: boolean | null
    }
}

const PROPERTY_SAVE_WATCHDOG_TIMEOUT_MS = 120_000
const PROPERTY_DRAFT_STORAGE_KEY = "imobi_property_form_draft_v1"
const PROPERTY_PENDING_OWNER_STORAGE_KEY = "imobi_property_form_pending_owner_v1"

function formatCurrencyInput(value: number | null | undefined) {
    if (!value || value <= 0) return ""
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(value)
}

function parseCurrencyInput(raw: string) {
    const digits = raw.replace(/\D/g, "")
    if (!digits) return 0
    return Number(digits)
}

function formatOptionalNumberInput(value: number | null | undefined) {
    if (!value || value <= 0) return ""
    return String(value)
}

function parseOptionalNumberInput(raw: string) {
    if (!raw.trim()) return 0
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const { user, organizationId, loading: authLoading } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [resolvedOrganizationId, setResolvedOrganizationId] = useState<string | null>(organizationId)
    const [isResolvingOrganization, setIsResolvingOrganization] = useState(false)
    const [brokers, setBrokers] = useState<Array<{ id: string; full_name: string | null }>>([])
    const [contacts, setContacts] = useState<Array<{ id: string; name: string | null }>>([])
    const [activeTab, setActiveTab] = useState<PropertyFormStepId>("essentials")
    const supabase = createClient()
    const focusFieldParam = searchParams.get("focus")
    const effectiveOrganizationId = organizationId ?? resolvedOrganizationId
    const form = useForm({
        resolver: zodResolver(propertySchema),
        defaultValues: {
            title: initialData?.title || "",
            description: initialData?.description || "",
            price: initialData?.price || 0,
            type: initialData?.type || DEFAULT_PROPERTY_TYPE,
            transaction_type: initialData?.transaction_type || "sale",
            assigned_to: initialData?.assigned_to || user?.id || "",
            owner_contact_id: initialData?.owner_contact_id || "",
            status: initialData?.status || "available",
            hide_from_site: Boolean(initialData?.hide_from_site ?? false),
            publish_to_portals: Boolean(initialData?.publish_to_portals ?? false),
            publish_zap: Boolean(initialData?.publish_zap ?? false),
            publish_imovelweb: Boolean(initialData?.publish_imovelweb ?? false),
            publish_olx: Boolean(initialData?.publish_olx ?? false),
            bedrooms: initialData?.features?.bedrooms || 0,
            bathrooms: initialData?.features?.bathrooms || 0,
            area: initialData?.features?.area || 0,
            address_street: (initialData?.address as PropertyAddress | undefined)?.street || "",
            address_number: (initialData?.address as PropertyAddress | undefined)?.number || "",
            address_neighborhood: (initialData?.address as PropertyAddress | undefined)?.neighborhood || "",
            address_city: (initialData?.address as PropertyAddress | undefined)?.city || "",
            address_state: (initialData?.address as PropertyAddress | undefined)?.state || "",
            address_zip: (initialData?.address as PropertyAddress | undefined)?.zip || "",
            address_country: (initialData?.address as PropertyAddress | undefined)?.country || "Brasil",
            address_full: (initialData?.address as PropertyAddress | undefined)?.full_address || "",
            images: initialData?.images || [],
        },
    })

    useEffect(() => {
        if (organizationId) {
            setResolvedOrganizationId(organizationId)
        }
    }, [organizationId])

    useEffect(() => {
        if (!user || authLoading || organizationId || resolvedOrganizationId || isResolvingOrganization) return

        let active = true

        const loadOrganizationId = async () => {
            setIsResolvingOrganization(true)

            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("organization_id")
                    .eq("id", user.id)
                    .maybeSingle()

                if (error) throw error
                if (active && data?.organization_id) {
                    setResolvedOrganizationId(data.organization_id)
                }
            } catch (error) {
                console.error("Error resolving organization for property form:", error)
            } finally {
                if (active) {
                    setIsResolvingOrganization(false)
                }
            }
        }

        void loadOrganizationId()

        return () => {
            active = false
        }
    }, [authLoading, isResolvingOrganization, organizationId, resolvedOrganizationId, supabase, user])

    useEffect(() => {
        if (!focusFieldParam) return
        setActiveTab(getPropertyFormStepForField(focusFieldParam))
        const el = document.getElementById(focusFieldParam)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        if (el instanceof HTMLElement) {
            el.focus()
        }
    }, [focusFieldParam])

    useEffect(() => {
        if (!user?.id) return
        if (form.getValues("assigned_to")) return
        form.setValue("assigned_to", user.id, { shouldDirty: false })
    }, [form, user?.id])

    useEffect(() => {
        if (!effectiveOrganizationId) return

        let active = true

        const loadBrokers = async () => {
            try {
                const [brokersResult, contactsResult] = await Promise.all([
                    supabase
                        .from("profiles")
                        .select("id, full_name")
                        .eq("organization_id", effectiveOrganizationId)
                        .eq("role", "broker")
                        .order("full_name"),
                    supabase
                        .from("contacts")
                        .select("id, name")
                        .eq("organization_id", effectiveOrganizationId)
                        .order("name"),
                ])

                if (brokersResult.error) throw brokersResult.error
                if (contactsResult.error) throw contactsResult.error
                if (active) {
                    setBrokers((brokersResult.data as Array<{ id: string; full_name: string | null }> | null) ?? [])
                    setContacts((contactsResult.data as Array<{ id: string; name: string | null }> | null) ?? [])
                }
            } catch (error) {
                console.error("Error loading property form relationships:", error)
            }
        }

        void loadBrokers()

        return () => {
            active = false
        }
    }, [effectiveOrganizationId, supabase])

    useEffect(() => {
        if (initialData || typeof window === "undefined") return

        const savedDraft = window.localStorage.getItem(PROPERTY_DRAFT_STORAGE_KEY)
        if (!savedDraft) return

        try {
            const parsed = JSON.parse(savedDraft) as Partial<PropertyFormValues>
            form.reset({
                title: parsed.title ?? "",
                description: parsed.description ?? "",
                price: parsed.price ?? 0,
                type: parsed.type ?? DEFAULT_PROPERTY_TYPE,
                transaction_type: parsed.transaction_type ?? "sale",
                assigned_to: parsed.assigned_to ?? user?.id ?? "",
                owner_contact_id: parsed.owner_contact_id ?? "",
                status: parsed.status ?? "available",
                hide_from_site: Boolean(parsed.hide_from_site ?? false),
                publish_to_portals: Boolean(parsed.publish_to_portals ?? false),
                publish_zap: Boolean(parsed.publish_zap ?? false),
                publish_imovelweb: Boolean(parsed.publish_imovelweb ?? false),
                publish_olx: Boolean(parsed.publish_olx ?? false),
                bedrooms: parsed.bedrooms ?? 0,
                bathrooms: parsed.bathrooms ?? 0,
                area: parsed.area ?? 0,
                address_street: parsed.address_street ?? "",
                address_number: parsed.address_number ?? "",
                address_neighborhood: parsed.address_neighborhood ?? "",
                address_city: parsed.address_city ?? "",
                address_state: parsed.address_state ?? "",
                address_zip: parsed.address_zip ?? "",
                address_country: parsed.address_country ?? "Brasil",
                address_full: parsed.address_full ?? "",
                images: parsed.images ?? [],
            })
        } catch (error) {
            console.error("Error restoring property draft:", error)
            window.localStorage.removeItem(PROPERTY_DRAFT_STORAGE_KEY)
        }
    }, [form, initialData, user?.id])

    useEffect(() => {
        if (initialData || typeof window === "undefined") return

        const subscription = form.watch((values) => {
            window.localStorage.setItem(PROPERTY_DRAFT_STORAGE_KEY, JSON.stringify(values))
        })

        return () => subscription.unsubscribe()
    }, [form, initialData])

    useEffect(() => {
        if (typeof window === "undefined") return

        const savedPendingOwner = window.localStorage.getItem(PROPERTY_PENDING_OWNER_STORAGE_KEY)
        if (!savedPendingOwner) return

        try {
            const pendingOwner = JSON.parse(savedPendingOwner) as { id?: string; name?: string }
            const pendingOwnerId = pendingOwner.id?.trim()
            if (!pendingOwnerId) {
                window.localStorage.removeItem(PROPERTY_PENDING_OWNER_STORAGE_KEY)
                return
            }

            setContacts((current) => {
                if (current.some((contact) => contact.id === pendingOwnerId)) return current
                return [{ id: pendingOwnerId, name: pendingOwner.name ?? "Contato selecionado" }, ...current]
            })

            form.reset(
                {
                    ...form.getValues(),
                    owner_contact_id: pendingOwnerId,
                },
                {
                    keepDefaultValues: true,
                }
            )
        } catch (error) {
            console.error("Error restoring pending property owner:", error)
        } finally {
            window.localStorage.removeItem(PROPERTY_PENDING_OWNER_STORAGE_KEY)
        }
    }, [contacts, form])

    const selectedTransactionType = form.watch("transaction_type")
    const watchedOwnerContactId = form.watch("owner_contact_id") ?? ""
    const watchedValues = form.watch() as PropertyFormValues
    const brokerOptions = [
        ...brokers,
        ...(watchedValues.assigned_to &&
        !brokers.some((broker) => broker.id === watchedValues.assigned_to)
            ? [
                {
                    id: watchedValues.assigned_to,
                    full_name:
                        watchedValues.assigned_to === user?.id
                            ? user.user_metadata?.full_name ?? user.email ?? "Usuário atual"
                            : "Responsável atual",
                },
            ]
            : []),
    ]
    const ownerOptions = [
        ...contacts,
        ...(watchedOwnerContactId &&
        !contacts.some((contact) => contact.id === watchedOwnerContactId)
            ? [
                {
                    id: watchedOwnerContactId,
                    name:
                        watchedOwnerContactId === initialData?.owner_contact_id
                            ? initialData?.owner_name ?? "Contato vinculado"
                            : "Contato selecionado",
                },
            ]
            : []),
    ]
    const selectedOwner = ownerOptions.find((contact) => contact.id === watchedOwnerContactId)
    const legacyOwnerName =
        !watchedOwnerContactId && initialData?.owner_name?.trim()
            ? initialData.owner_name.trim()
            : ""
    const watchedTitle = watchedValues.title?.trim() ?? ""
    const titleLength = watchedTitle.length
    const descriptionLength = watchedValues.description?.trim().length ?? 0
    const titleQualityLabel =
        titleLength >= 24
            ? "Bom para vitrine"
            : titleLength >= 12
                ? "Aceitável"
                : "Fraco"
    const descriptionQualityLabel =
        descriptionLength >= 220
            ? "Descrição forte"
            : descriptionLength >= 120
                ? "Descrição boa"
                : descriptionLength >= 80
                    ? "Descrição mínima"
                    : "Descrição fraca"
    const titleSuggestion = buildSuggestedPropertyTitle({
        type: watchedValues.type,
        transactionType: watchedValues.transaction_type,
        bedrooms: watchedValues.bedrooms,
        bathrooms: watchedValues.bathrooms,
        area: watchedValues.area,
        neighborhood: watchedValues.address_neighborhood,
        city: watchedValues.address_city,
    })
    const watchedDescription = watchedValues.description?.trim() ?? ""
    const descriptionSuggestion = buildSuggestedPropertyDescription({
        type: watchedValues.type,
        transactionType: watchedValues.transaction_type,
        bedrooms: watchedValues.bedrooms,
        bathrooms: watchedValues.bathrooms,
        area: watchedValues.area,
        neighborhood: watchedValues.address_neighborhood,
        city: watchedValues.address_city,
    })
    const imageCount = watchedValues.images?.length ?? 0
    const mediaQuality =
        imageCount === 0
            ? {
                label: "Sem fotos",
                className: "border-red-200 bg-red-50 text-red-700",
                helper: "Adicione fotos antes de publicar no site e nos portais.",
            }
            : imageCount < 5
                ? {
                    label: "Galeria fraca",
                    className: "border-amber-200 bg-amber-50 text-amber-800",
                    helper: "Tente subir pelo menos 5 fotos para melhorar vitrine e ranqueamento.",
                }
                : {
                    label: "Boa galeria",
                    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
                    helper: "A galeria já está em um nível bom para publicação.",
                }
    const coverImage = watchedValues.images?.[0] ?? null
    const priceLabel =
        selectedTransactionType === "rent"
            ? "Preço de Locação (R$)"
            : selectedTransactionType === "seasonal"
                ? "Preço de Temporada (R$)"
                : "Preço de Venda (R$)"

    const operationalSnapshot = getPropertyOperationalSnapshot({
        id: initialData?.id,
        public_code: initialData?.id,
        title: watchedValues.title,
        type: watchedValues.type,
        transaction_type: watchedValues.transaction_type,
        price: watchedValues.price,
        description: watchedValues.description,
        assigned_to: watchedValues.assigned_to || user?.id || "",
        status: watchedValues.status,
        hide_from_site: watchedValues.hide_from_site,
        publish_to_portals: watchedValues.publish_to_portals,
        publish_zap: watchedValues.publish_zap,
        publish_imovelweb: watchedValues.publish_imovelweb,
        publish_olx: watchedValues.publish_olx,
        images: watchedValues.images,
        features: {
            bedrooms: watchedValues.bedrooms,
            bathrooms: watchedValues.bathrooms,
            area: watchedValues.area,
        },
        address: {
            full_address: watchedValues.address_full,
            street: watchedValues.address_street,
            neighborhood: watchedValues.address_neighborhood,
            city: watchedValues.address_city,
            state: watchedValues.address_state,
        },
    })

    const operationalLabel = getPropertyOperationalStatusLabel(operationalSnapshot.status)
    const sitePublishIssues = getPropertyPublishIssues({
        address: {
            city: watchedValues.address_city,
        },
        images: watchedValues.images,
        description: watchedValues.description,
        price: watchedValues.price,
        type: watchedValues.type,
    })
    const siteReady = isPropertyPublishReady({
        address: {
            city: watchedValues.address_city,
        },
        images: watchedValues.images,
        description: watchedValues.description,
        price: watchedValues.price,
        type: watchedValues.type,
    })
    const portalBlockingIssues = operationalSnapshot.criticalIssues
    const portalWarningIssues = operationalSnapshot.lightIssues
    const statusBadgeClass =
        operationalSnapshot.status === "draft"
            ? "bg-slate-100 text-slate-800 border-slate-200"
            : operationalSnapshot.status === "publishable"
                ? "bg-sky-100 text-sky-800 border-sky-200"
                : operationalSnapshot.status === "published_low_quality"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200"

    const ownerSelectionMissing = !watchedOwnerContactId && !legacyOwnerName
    const ownerStepIssue = ownerSelectionMissing
        ? {
            code: "missing_owner",
            label: "Sem proprietário",
            severity: "light" as const,
            group: "owner",
            focusFieldId: "property-owner",
        }
        : null
    const stepIssueCounts = countPropertyIssuesByStep([
        ...operationalSnapshot.criticalIssues,
        ...operationalSnapshot.lightIssues,
        ...(ownerStepIssue ? [ownerStepIssue] : []),
    ])
    const summaryIssues = ownerStepIssue
        ? [...operationalSnapshot.displayIssues, ownerStepIssue].slice(0, 4)
        : operationalSnapshot.displayIssues

    const focusFieldInput = (fieldId?: string | null) => {
        if (!fieldId) return
        setActiveTab(getPropertyFormStepForField(fieldId))
        const el = document.getElementById(fieldId)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        if (el instanceof HTMLElement) {
            el.focus()
        }
    }

    const handleOwnerCreated = (owner: { id: string; name: string }) => {
        setContacts((current) => {
            if (current.some((contact) => contact.id === owner.id)) return current
            return [{ id: owner.id, name: owner.name }, ...current]
        })
        const nextValues = {
            ...form.getValues(),
            owner_contact_id: owner.id,
        }
        if (!initialData && typeof window !== "undefined") {
            window.localStorage.setItem(PROPERTY_DRAFT_STORAGE_KEY, JSON.stringify(nextValues))
        }
        if (typeof window !== "undefined") {
            window.localStorage.setItem(
                PROPERTY_PENDING_OWNER_STORAGE_KEY,
                JSON.stringify({ id: owner.id, name: owner.name })
            )
        }
        form.reset(
            nextValues,
            {
                keepDefaultValues: true,
            }
        )
    }

    async function onSubmit(data: PropertyFormValues) {
        if (isLoading) return

        setIsLoading(true)
        setSubmitError(null)
        let uiWatchdogFired = false
        const uiWatchdog: ReturnType<typeof setTimeout> = setTimeout(() => {
            uiWatchdogFired = true
            console.warn("Property save watchdog fired (still waiting for response)")
            toast.info("O salvamento está demorando mais do que o normal, mas ainda está em andamento.")
        }, PROPERTY_SAVE_WATCHDOG_TIMEOUT_MS)
        try {
            const result = await saveProperty({
                ...data,
                id: initialData?.id,
            })

            if (!result.success) {
                setSubmitError(result.error)
                toast.error(result.error)
                return
            }

            if (!initialData && typeof window !== "undefined") {
                window.localStorage.removeItem(PROPERTY_DRAFT_STORAGE_KEY)
            }

            toast.success(
                uiWatchdogFired
                    ? initialData
                        ? "Imóvel atualizado com sucesso após espera maior que o normal."
                        : "Imóvel cadastrado com sucesso após espera maior que o normal."
                    : initialData
                        ? "Imóvel atualizado com sucesso!"
                        : "Imóvel cadastrado com sucesso!"
            )
            router.push(`/properties/${result.data.id}`)
        } catch (error) {
            console.error('Error saving property:', error)
            const msg =
                error instanceof Error ? error.message : "Erro ao salvar imóvel. Tente novamente."
            setSubmitError(msg)
            toast.error(msg)
        } finally {
            clearTimeout(uiWatchdog)
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-32">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="min-w-0 space-y-6">
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PropertyFormStepId)} className="min-w-0 w-full">
                            <PropertyFormStepNav
                                activeStep={activeTab}
                                issueCounts={stepIssueCounts}
                                onStepChange={setActiveTab}
                            />

                            <TabsContent value="essentials" className="min-w-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Título e Preço */}
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título do Anúncio</FormLabel>
                                    <FormControl>
                                        <Input id="property-title" placeholder="Ex: Apartamento no Centro com 2 quartos" {...field} />
                                    </FormControl>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <span>
                                            {titleQualityLabel} · {titleLength} caracteres
                                        </span>
                                        {titleSuggestion && titleSuggestion !== watchedTitle ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto max-w-full justify-start whitespace-normal px-0 py-0 text-left text-xs font-medium text-primary"
                                                onClick={() => form.setValue("title", titleSuggestion, { shouldDirty: true })}
                                            >
                                                Usar sugestão: {titleSuggestion}
                                            </Button>
                                        ) : null}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{priceLabel}</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="property-price"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="R$ 0"
                                            value={formatCurrencyInput(field.value as number)}
                                            onChange={(event) => field.onChange(parseCurrencyInput(event.target.value))}
                                        />
                                    </FormControl>
                                    <div className="text-xs text-muted-foreground">
                                        Valor salvo: {formatCurrencyInput((field.value as number) || 0) || "R$ 0"}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Detalhes Básicos */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                                                <SelectItem key={propertyType.value} value={propertyType.value}>
                                                    {propertyType.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div id="property-type" className="sr-only" aria-hidden="true" />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="transaction_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Finalidade</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="sale">Venda</SelectItem>
                                            <SelectItem value="rent">Locação</SelectItem>
                                            <SelectItem value="seasonal">Temporada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div id="property-transaction-type" className="sr-only" aria-hidden="true" />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="assigned_to"
                            render={({ field }) => (
                                <FormItem className="col-span-2">
                                    <FormLabel>Responsável</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value === "__unassigned__" ? "" : value)}
                                        value={field.value || "__unassigned__"}
                                    >
                                        <FormControl>
                                            <SelectTrigger id="property-responsible">
                                                <SelectValue placeholder="Selecione o responsável" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__unassigned__">Sem responsável</SelectItem>
                                            {brokerOptions.map((broker) => (
                                                <SelectItem key={broker.id} value={broker.id}>
                                                    {broker.full_name || "Corretor sem nome"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="area"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Área (m²)</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="property-area"
                                            type="number"
                                            placeholder="Ex: 120"
                                            value={formatOptionalNumberInput(field.value as number)}
                                            onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bedrooms"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quartos</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="property-bedrooms"
                                            type="number"
                                            placeholder="Ex: 3"
                                            value={formatOptionalNumberInput(field.value as number)}
                                            onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bathrooms"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Banheiros</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="property-bathrooms"
                                            type="number"
                                            placeholder="Ex: 2"
                                            value={formatOptionalNumberInput(field.value as number)}
                                            onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
                            </TabsContent>

                            <TabsContent value="owner" className="min-w-0 space-y-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Proprietário do imóvel</CardTitle>
                        <CardDescription>
                            Vincule um contato real ou crie um proprietário mínimo sem sair do cadastro.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="owner_contact_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proprietário principal</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value === "__unlinked__" ? "" : value)}
                                        value={field.value || "__unlinked__"}
                                    >
                                        <FormControl>
                                            <SelectTrigger id="property-owner">
                                                <SelectValue placeholder="Selecione um contato" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__unlinked__">
                                                {legacyOwnerName ? "Manter nome legado sem vínculo" : "Sem proprietário vinculado"}
                                            </SelectItem>
                                            {ownerOptions.map((contact) => (
                                                <SelectItem key={contact.id} value={contact.id}>
                                                    {contact.name || "Contato sem nome"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Vincule um contato real para facilitar busca, revisão e futuras negociações com o proprietário.
                                    </p>
                                    {selectedOwner?.name ? (
                                        <p className="text-xs text-foreground">
                                            Proprietário selecionado: <span className="font-medium">{selectedOwner.name}</span>
                                        </p>
                                    ) : legacyOwnerName ? (
                                        <p className="text-xs text-muted-foreground">
                                            Nome legado atual: <span className="font-medium text-foreground">{legacyOwnerName}</span>
                                        </p>
                                    ) : (
                                        <p className="text-xs text-amber-700">
                                            Ainda não há proprietário vinculado. Isso não bloqueia o save, mas deixa a ficha incompleta.
                                        </p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <PropertyOwnerQuickCreate
                            disabled={isLoading}
                            onCreated={handleOwnerCreated}
                        />
                    </CardContent>
                </Card>
                            </TabsContent>

                            <TabsContent value="commercial" className="min-w-0 space-y-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Qualidade comercial</CardTitle>
                        <CardDescription>
                            Quanto melhor o título e a descrição, melhor tende a ser a performance no site e nos portais.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-muted-foreground">Título</span>
                            <Badge
                                variant="outline"
                                className={
                                    titleLength >= 24
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : titleLength >= 12
                                            ? "border-amber-200 bg-amber-50 text-amber-800"
                                            : "border-red-200 bg-red-50 text-red-700"
                                }
                            >
                                {titleQualityLabel}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-muted-foreground">Descrição</span>
                            <Badge
                                variant="outline"
                                className={
                                    descriptionLength >= 220
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : descriptionLength >= 80
                                            ? "border-amber-200 bg-amber-50 text-amber-800"
                                            : "border-red-200 bg-red-50 text-red-700"
                                }
                            >
                                {descriptionQualityLabel}
                            </Badge>
                        </div>
                        <div className="rounded-md border border-dashed px-3 py-2 text-muted-foreground">
                            Dica: destaque tipologia, localização e um diferencial forte do imóvel logo no início.
                        </div>
                    </CardContent>
                </Card>
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descrição Detalhada</FormLabel>
                            <FormControl>
                                <Textarea
                                    id="property-description"
                                    placeholder="Descreva o imóvel, diferenciais, localização..."
                                    className="min-h-[120px]"
                                    {...field}
                                />
                            </FormControl>
                            <div className="text-xs text-muted-foreground">
                                {descriptionQualityLabel} · {descriptionLength} caracteres
                                {descriptionSuggestion && descriptionSuggestion !== watchedDescription ? (
                                    <>
                                        {" · "}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto max-w-full justify-start whitespace-normal px-0 py-0 text-left text-xs font-medium text-primary"
                                            onClick={() => form.setValue("description", descriptionSuggestion, { shouldDirty: true })}
                                        >
                                            Usar sugestão
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                            </TabsContent>

                            <TabsContent value="location" className="min-w-0 space-y-6">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold">Endereço</h3>
                        <p className="text-xs text-muted-foreground">
                            Preencha o endereço estruturado. Isso melhora publicação em portais e qualidade do anúncio.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="address_street"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rua / Avenida</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Av. Paulista" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Número</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: 1000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address_neighborhood"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bairro</FormLabel>
                                    <FormControl>
                                        <Input id="address_neighborhood" placeholder="Ex: Centro" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                <FormField
                    control={form.control}
                    name="address_city"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                                <Input id="address_city" placeholder="Ex: São Paulo" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                        <FormField
                            control={form.control}
                            name="address_state"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>UF</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: SP" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address_zip"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>CEP</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: 01310-000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="address_full"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Endereço completo (opcional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: Av. Paulista, 1000 - Bela Vista - São Paulo - SP" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                            </TabsContent>

                            <TabsContent value="media" className="min-w-0 space-y-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between gap-3 text-base">
                            <span>Mídia do anúncio</span>
                            <Badge variant="outline" className={mediaQuality.className}>
                                {mediaQuality.label}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            A primeira foto é a capa principal e influencia diretamente a vitrine do imóvel.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-md border px-3 py-2 text-xs">
                                <div className="text-muted-foreground">Fotos</div>
                                <div className="mt-1 text-sm font-medium text-foreground">{imageCount}</div>
                            </div>
                            <div className="rounded-md border px-3 py-2 text-xs">
                                <div className="text-muted-foreground">Capa principal</div>
                                <div className="mt-1 text-sm font-medium text-foreground">
                                    {coverImage ? "Definida" : "Pendente"}
                                </div>
                            </div>
                            <div className="rounded-md border px-3 py-2 text-xs">
                                <div className="text-muted-foreground">Orientação</div>
                                <div className="mt-1 text-sm font-medium text-foreground">
                                    {mediaQuality.helper}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                        <FormItem id="property-images">
                            <FormLabel>Fotos do imóvel</FormLabel>
                            <FormControl>
                                <ImageUpload
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={isLoading}
                                    organizationId={effectiveOrganizationId}
                                />
                            </FormControl>
                            {!effectiveOrganizationId ? (
                                <div className="text-xs text-amber-700">
                                    {authLoading || isResolvingOrganization
                                        ? "Carregando organização para liberar o upload de fotos..."
                                        : "Não foi possível identificar sua organização. Recarregue a página e tente novamente."}
                                </div>
                            ) : null}
                            <FormMessage />
                        </FormItem>
                    )}
                />
                            </TabsContent>

                            <TabsContent value="publication" className="min-w-0 space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between gap-3 text-base">
                                <span>Checklist do Site</span>
                                <Badge
                                    variant="outline"
                                    className={siteReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}
                                >
                                    {siteReady ? "Pronto" : "Com ajustes"}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Valida o mínimo para o imóvel aparecer bem no site público.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                                    {sitePublishIssues.length > 0 ? (
                                sitePublishIssues.map((issue) => (
                                    <button
                                        key={`site-${issue.key}`}
                                        type="button"
                                        onClick={() => focusFieldInput(issue.focusFieldId)}
                                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${
                                            issue.severity === "blocking"
                                                ? "border-red-200 bg-red-50 text-red-700"
                                                : "border-amber-200 bg-amber-50 text-amber-800"
                                        }`}
                                    >
                                        <span>{issue.label}</span>
                                        <span className="font-medium">
                                            {issue.severity === "blocking" ? "Bloqueia" : "Melhorar"}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                    Site sem bloqueios relevantes nesta primeira versão.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between gap-3 text-base">
                                <span>Checklist de Portais</span>
                                <Badge
                                    variant="outline"
                                    className={portalBlockingIssues.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}
                                >
                                    {portalBlockingIssues.length === 0 ? "Pronto" : "Com ajustes"}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Resume o que ainda enfraquece publicação e distribuição nos portais.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[...portalBlockingIssues, ...portalWarningIssues].length > 0 ? (
                                [...portalBlockingIssues, ...portalWarningIssues].map((issue) => (
                                    <button
                                        key={`portal-${issue.code}`}
                                        type="button"
                                        onClick={() => focusFieldInput(issue.focusFieldId)}
                                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${
                                            issue.severity === "critical"
                                                ? "border-red-200 bg-red-50 text-red-700"
                                                : "border-amber-200 bg-amber-50 text-amber-800"
                                        }`}
                                    >
                                        <span>{issue.label}</span>
                                        <span className="font-medium">
                                            {issue.severity === "critical" ? "Crítico" : "Melhorar"}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                    Portais sem pendências principais na leitura operacional atual.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="available">Disponível</SelectItem>
                                    <SelectItem value="sold">Vendido</SelectItem>
                                    <SelectItem value="rented">Alugado</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                Status é comercial (Disponível/Vendido/Alugado) e não controla sozinho a exibição no site.
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="hide_from_site"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
                                <div className="space-y-1">
                                    <FormLabel className="m-0">Exibir no site</FormLabel>
                                    <div className="text-xs text-muted-foreground">
                                        Controla a vitrine pública (site + feed de portais). O status comercial continua independente.
                                    </div>
                                </div>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <input
                                            id="property-site-visibility"
                                            type="checkbox"
                                            checked={!Boolean(field.value)}
                                            onChange={(e) => field.onChange(!e.target.checked)}
                                            disabled={isLoading}
                                            className="h-4 w-4"
                                            aria-label="Exibir no site"
                                        />
                                        <Label className="text-sm text-muted-foreground">
                                            {Boolean(field.value) ? "Oculto" : "Exibido"}
                                        </Label>
                                    </div>
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="rounded-md border p-3 space-y-3">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">Portais</div>
                        <div className="text-xs text-muted-foreground">
                            Controle a distribuição do imóvel para os canais integrados sem sair da edição.
                        </div>
                    </div>

                    <FormField
                        control={form.control}
                        name="publish_to_portals"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                                    <div className="space-y-1">
                                        <FormLabel className="m-0">Habilitar portais</FormLabel>
                                        <div className="text-xs text-muted-foreground">
                                            Quando desligado, o imóvel não entra nos feeds de portais.
                                        </div>
                                    </div>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="property-publish-to-portals"
                                                type="checkbox"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => {
                                                    const nextPortalValues = getNextPortalPublicationValues(e.target.checked)
                                                    field.onChange(nextPortalValues.publish_to_portals)
                                                    form.setValue("publish_imovelweb", nextPortalValues.publish_imovelweb, { shouldDirty: true })
                                                    form.setValue("publish_zap", nextPortalValues.publish_zap, { shouldDirty: true })
                                                    form.setValue("publish_olx", nextPortalValues.publish_olx, { shouldDirty: true })
                                                }}
                                                disabled={isLoading}
                                                className="h-4 w-4"
                                                aria-label="Habilitar portais"
                                            />
                                            <Label className="text-sm text-muted-foreground">
                                                {Boolean(field.value) ? "Ativado" : "Desativado"}
                                            </Label>
                                        </div>
                                    </FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-3 md:grid-cols-3">
                        <FormField
                            control={form.control}
                            name="publish_imovelweb"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                                        <div className="space-y-1">
                                            <FormLabel className="m-0">Imovelweb</FormLabel>
                                            <div className="text-xs text-muted-foreground">
                                                Feed do Imovelweb.
                                            </div>
                                        </div>
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                                disabled={isLoading || !Boolean(form.watch("publish_to_portals"))}
                                                className="mt-1 h-4 w-4"
                                                aria-label="Publicar no Imovelweb"
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="publish_zap"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                                        <div className="space-y-1">
                                            <FormLabel className="m-0">ZAP</FormLabel>
                                            <div className="text-xs text-muted-foreground">
                                                Feed XML do ZAP+.
                                            </div>
                                        </div>
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                                disabled={isLoading || !Boolean(form.watch("publish_to_portals"))}
                                                className="mt-1 h-4 w-4"
                                                aria-label="Publicar no ZAP"
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="publish_olx"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                                        <div className="space-y-1">
                                            <FormLabel className="m-0">OLX</FormLabel>
                                            <div className="text-xs text-muted-foreground">
                                                Canal opcional da distribuição.
                                            </div>
                                        </div>
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                                disabled={isLoading || !Boolean(form.watch("publish_to_portals"))}
                                                className="mt-1 h-4 w-4"
                                                aria-label="Publicar na OLX"
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-3">
                                    <span>Prontidão operacional</span>
                                    <Badge variant="outline" className={statusBadgeClass}>
                                        {operationalLabel}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>{operationalSnapshot.reasonSummary}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {PROPERTY_FORM_STEPS.map((step) => {
                                        const issueCount = stepIssueCounts[step.id]
                                        const isOk = issueCount === 0
                                        return (
                                            <button
                                                key={step.id}
                                                type="button"
                                                onClick={() => setActiveTab(step.id)}
                                                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                                                    isOk
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                                        : "border-amber-200 bg-amber-50 text-amber-900"
                                                }`}
                                            >
                                                <div className="font-medium">{step.shortLabel}</div>
                                                <div className="text-[11px] opacity-80">
                                                    {isOk ? "Sem pendências principais" : `${issueCount} pendência(s)`}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">Principais pendências</div>
                                    {summaryIssues.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {summaryIssues.map((issue) => (
                                                <button
                                                    key={issue.code}
                                                    type="button"
                                                    onClick={() => focusFieldInput(issue.focusFieldId)}
                                                    className={`rounded-full border px-3 py-1 text-xs ${
                                                        issue.severity === "critical"
                                                            ? "border-red-200 bg-red-50 text-red-700"
                                                            : "border-amber-200 bg-amber-50 text-amber-800"
                                                    }`}
                                                >
                                                    {issue.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                            Cadastro consistente para seguir com publicação.
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                    O status operacional é automático e considera dados essenciais, descrição, localização e mídia.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {submitError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {submitError}
                    </div>
                ) : null}

                <PropertyFormSaveBar
                    isLoading={isLoading}
                    isEdit={Boolean(initialData)}
                    hasErrors={Boolean(submitError) || Object.keys(form.formState.errors).length > 0}
                    statusText={submitError ?? undefined}
                    onCancel={() => router.push(initialData ? `/properties/${initialData.id}` : "/properties")}
                />
            </form>
        </Form>
    )
}
