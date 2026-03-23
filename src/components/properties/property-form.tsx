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

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { propertySchema, type PropertyFormValues, type PropertyFeatures, type PropertyAddress } from "@/lib/types"
import { deriveStoragePathsForBucket } from "@/lib/media"

interface PropertyFormProps {
    initialData?: {
        id: string
        title: string
        description?: string
        price: number
        type: string
        transaction_type?: string | null
        status: string
        features: PropertyFeatures
        address: PropertyAddress
        images?: string[]
        image_paths?: string[]
        hide_from_site?: boolean | null
    }
}

const PROPERTY_SAVE_WATCHDOG_TIMEOUT_MS = 120_000
const PROPERTY_DRAFT_STORAGE_KEY = "imobi_property_form_draft_v1"

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
    const [resolvedOrganizationId, setResolvedOrganizationId] = useState<string | null>(organizationId)
    const [isResolvingOrganization, setIsResolvingOrganization] = useState(false)
    const supabase = createClient()
    const focusField = searchParams.get("focus")
    const effectiveOrganizationId = organizationId ?? resolvedOrganizationId

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
        if (!focusField) return
        const el = document.getElementById(focusField)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            el.focus()
        }
    }, [focusField])

    const form = useForm({
        resolver: zodResolver(propertySchema),
        defaultValues: {
            title: initialData?.title || "",
            description: initialData?.description || "",
            price: initialData?.price || 0,
            type: initialData?.type || "apartment",
            transaction_type: initialData?.transaction_type || "sale",
            status: initialData?.status || "available",
            hide_from_site: Boolean(initialData?.hide_from_site ?? false),
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
        if (initialData || typeof window === "undefined") return

        const savedDraft = window.localStorage.getItem(PROPERTY_DRAFT_STORAGE_KEY)
        if (!savedDraft) return

        try {
            const parsed = JSON.parse(savedDraft) as Partial<PropertyFormValues>
            form.reset({
                title: parsed.title ?? "",
                description: parsed.description ?? "",
                price: parsed.price ?? 0,
                type: parsed.type ?? "apartment",
                transaction_type: parsed.transaction_type ?? "sale",
                status: parsed.status ?? "available",
                hide_from_site: Boolean(parsed.hide_from_site ?? false),
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
    }, [form, initialData])

    useEffect(() => {
        if (initialData || typeof window === "undefined") return

        const subscription = form.watch((values) => {
            window.localStorage.setItem(PROPERTY_DRAFT_STORAGE_KEY, JSON.stringify(values))
        })

        return () => subscription.unsubscribe()
    }, [form, initialData])

    const buildFullAddress = (data: PropertyFormValues) => {
        const parts = [
            data.address_street,
            data.address_number ? `, ${data.address_number}` : "",
        ].join("")

        const locality = [
            data.address_neighborhood,
            data.address_city,
            data.address_state,
        ].filter(Boolean).join(" - ")

        const zip = data.address_zip ? `CEP ${data.address_zip}` : ""

        return [parts, locality, zip].filter(Boolean).join(" | ").trim()
    }

    const selectedTransactionType = form.watch("transaction_type")
    const priceLabel =
        selectedTransactionType === "rent"
            ? "Preço de Locação (R$)"
            : selectedTransactionType === "seasonal"
                ? "Preço de Temporada (R$)"
                : "Preço de Venda (R$)"

    async function onSubmit(data: PropertyFormValues) {
        if (!user) return
        if (isLoading) return

        setIsLoading(true)
        let uiWatchdogFired = false
        const uiWatchdog: ReturnType<typeof setTimeout> = setTimeout(() => {
            uiWatchdogFired = true
            console.warn("Property save watchdog fired (still waiting for response)")
            toast.info("O salvamento está demorando mais do que o normal, mas ainda está em andamento.")
        }, PROPERTY_SAVE_WATCHDOG_TIMEOUT_MS)
        try {
            // Avoid an extra roundtrip to `profiles` and reduce the chance of aborted requests during navigation.
            const orgId = effectiveOrganizationId
            if (!orgId) {
                throw new Error("Organization not loaded")
            }

            // 2. Prepare payload
            const {
                bedrooms: _bedrooms,
                bathrooms: _bathrooms,
                area: _area,
                address_street,
                address_number,
                address_neighborhood,
                address_city,
                address_state,
                address_zip,
                address_country,
                address_full,
                images: _images,
                ...rest
            } = data
            void _bedrooms
            void _bathrooms
            void _area
            void _images

            const computedFullAddress = (address_full && address_full.trim()) ? address_full.trim() : buildFullAddress(data)

            const basePayload = {
                ...rest,
                organization_id: orgId,
                broker_id: user.id,
                features: {
                    bedrooms: data.bedrooms,
                    bathrooms: data.bathrooms,
                    area: data.area,
                    type: data.type
                },
                address: {
                    full_address: computedFullAddress || null,
                    street: address_street || null,
                    number: address_number || null,
                    neighborhood: address_neighborhood || null,
                    city: address_city || null,
                    state: address_state || null,
                    zip: address_zip || null,
                    country: address_country || null,
                },
                images: data.images || [],
                image_paths: deriveStoragePathsForBucket(data.images, "properties"),
            }

            if (initialData?.id) {
                // UPDATE
                // Require the updated row back so a silent RLS/no-op does not
                // look like a successful save in the UI.
                const { data: updatedProperty, error } = await supabase
                    .from('properties')
                    .update(basePayload)
                    .eq('id', initialData.id)
                    .select('id')
                    .maybeSingle()
                if (error) throw error
                if (!updatedProperty?.id) {
                    throw new Error("Property update did not persist")
                }
            } else {
                // INSERT
                const { error } = await supabase
                    .from('properties')
                    .insert(basePayload)
                if (error) throw error
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
            router.push('/properties')
        } catch (error) {
            console.error('Error saving property:', error)
            const msg = error instanceof Error && error.message === "Organization not loaded"
                    ? "Sua organização ainda está carregando. Aguarde 2s e tente novamente."
                    : error instanceof Error && error.message === "Property update did not persist"
                        ? "O imóvel não foi atualizado. Verifique sua permissão ou recarregue a página e tente novamente."
                    : "Erro ao salvar imóvel. Tente novamente."
            toast.error(msg)
        } finally {
            clearTimeout(uiWatchdog)
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-32">
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
                                        <Input placeholder="Ex: Apartamento no Centro com 2 quartos" {...field} />
                                    </FormControl>
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
                                            <SelectItem value="apartment">Apartamento</SelectItem>
                                            <SelectItem value="house">Casa</SelectItem>
                                            <SelectItem value="land">Terreno</SelectItem>
                                            <SelectItem value="commercial">Comercial</SelectItem>
                                        </SelectContent>
                                    </Select>
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

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descrição Detalhada</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Descreva o imóvel, diferenciais, localização..."
                                    className="min-h-[120px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

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
                                        <Input placeholder="Ex: Centro" {...field} />
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

                <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                        <FormItem id="property-images">
                            <FormLabel>Fotos do Imóvel</FormLabel>
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

                <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? 'Salvar Alterações' : 'Cadastrar Imóvel'}
                </Button>
            </form>
        </Form>
    )
}
