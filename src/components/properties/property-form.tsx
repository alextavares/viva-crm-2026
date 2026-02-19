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
        status: string
        features: PropertyFeatures
        address: PropertyAddress
        images?: string[]
        image_paths?: string[]
        hide_from_site?: boolean | null
    }
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const { user, organizationId } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()
    const focusField = searchParams.get("focus")

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

    async function execWithTimeout<T>(promiseFactory: (signal: AbortSignal) => Promise<T>, ms = 30_000): Promise<T> {
        const controller = new AbortController()
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                controller.abort()
                const err = new Error("RequestTimeout")
                err.name = "TimeoutError"
                reject(err)
            }, ms)
        })

        try {
            return await Promise.race([promiseFactory(controller.signal), timeoutPromise])
        } finally {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }

    async function onSubmit(data: PropertyFormValues) {
        if (!user) return
        if (isLoading) return

        setIsLoading(true)
        // UI watchdog: even if a request gets stuck (Supabase lock/fetch oddities),
        // never leave the user in an infinite spinner.
        const uiWatchdog: ReturnType<typeof setTimeout> = setTimeout(() => {
            console.warn("Property save watchdog fired (still loading after timeout)")
            toast.error("Demorou demais para salvar. Tente novamente.")
            setIsLoading(false)
        }, 45_000)
        try {
            // Avoid an extra roundtrip to `profiles` and reduce the chance of aborted requests during navigation.
            const orgId = organizationId
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
                // Include images in update (since we now have a proper UI for managing them)
                const { error } = await execWithTimeout(async (signal) => {
                    // Use an explicit await to avoid any edge cases with builder thenables + Promise.race.
                    return await supabase
                        .from('properties')
                        .update(basePayload)
                        .eq('id', initialData.id)
                        .select('id')
                        .single()
                        .abortSignal(signal)
                })
                if (error) throw error
            } else {
                // INSERT
                const { error } = await execWithTimeout(async (signal) => {
                    return await supabase
                        .from('properties')
                        .insert(basePayload)
                        .select('id')
                        .single()
                        .abortSignal(signal)
                })
                if (error) throw error
            }

            toast.success(initialData ? "Imóvel atualizado com sucesso!" : "Imóvel cadastrado com sucesso!")
            router.push('/properties')
        } catch (error) {
            console.error('Error saving property:', error)
            const isAbort =
                typeof error === "object" &&
                error !== null &&
                "name" in error &&
                ((error as { name?: unknown }).name === "AbortError" || (error as { name?: unknown }).name === "TimeoutError")

            const msg = isAbort
                ? "Demorou demais para salvar. Tente novamente."
                : error instanceof Error && error.message === "Organization not loaded"
                    ? "Sua organização ainda está carregando. Aguarde 2s e tente novamente."
                    : "Erro ao salvar imóvel. Tente novamente."
            toast.error(msg)
        } finally {
            clearTimeout(uiWatchdog)
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                                    <FormLabel>Preço de Venda (R$)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="0,00" {...field} value={field.value as number} />
                                    </FormControl>
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
                            name="area"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Área (m²)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} value={field.value as number} />
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
                                        <Input type="number" {...field} value={field.value as number} />
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
                                        <Input type="number" {...field} value={field.value as number} />
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
                                    organizationId={organizationId}
                                />
                            </FormControl>
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
