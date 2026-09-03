'use client'

import { useState } from "react"
import { toast } from "sonner"

import { saveContactInterestProfile } from "@/app/actions/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { InterestProfile } from "@/lib/types"

type InterestProfileFormProps = {
    contactId: string
    initial: InterestProfile
}

type FormState = {
    transaction: string
    property_type: string
    price_min: string
    price_max: string
    city: string
}

function optionalNumber(value: string) {
    if (!value.trim()) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function toFormState(initial: InterestProfile): FormState {
    return {
        transaction: initial.transaction ?? "",
        property_type: initial.property_type ?? "",
        price_min: initial.price_min !== undefined ? String(initial.price_min) : "",
        price_max: initial.price_max !== undefined ? String(initial.price_max) : "",
        city: initial.city ?? "",
    }
}

export function InterestProfileForm({ contactId, initial }: InterestProfileFormProps) {
    const [form, setForm] = useState<FormState>(() => toFormState(initial))
    const [pending, setPending] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setPending(true)

        try {
            const result = await saveContactInterestProfile({
                contact_id: contactId,
                profile: {
                    transaction: (form.transaction || undefined) as InterestProfile["transaction"],
                    property_type: (form.property_type || undefined) as InterestProfile["property_type"],
                    price_min: optionalNumber(form.price_min),
                    price_max: optionalNumber(form.price_max),
                    city: form.city,
                },
            })

            if (!result.success) {
                toast.error(result.error)
                return
            }

            toast.success("Perfil de interesse salvo.")
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao salvar perfil de interesse."
            toast.error(message)
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="interest-transaction">Transação</Label>
                    <Select
                        value={form.transaction || "unset"}
                        onValueChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                transaction: value === "unset" ? "" : value,
                            }))
                        }
                    >
                        <SelectTrigger id="interest-transaction">
                            <SelectValue placeholder="Não informar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unset">Não informar</SelectItem>
                            <SelectItem value="sale">Compra</SelectItem>
                            <SelectItem value="rent">Locação</SelectItem>
                            <SelectItem value="both">Ambos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="interest-property-type">Tipo de imóvel</Label>
                    <Select
                        value={form.property_type || "unset"}
                        onValueChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                property_type: value === "unset" ? "" : value,
                            }))
                        }
                    >
                        <SelectTrigger id="interest-property-type">
                            <SelectValue placeholder="Não informar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unset">Não informar</SelectItem>
                            <SelectItem value="apartment">Apartamento</SelectItem>
                            <SelectItem value="house">Casa</SelectItem>
                            <SelectItem value="land">Terreno</SelectItem>
                            <SelectItem value="commercial">Comercial</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="interest-price-min">Valor mínimo</Label>
                    <Input
                        id="interest-price-min"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={form.price_min}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                price_min: event.target.value,
                            }))
                        }
                        placeholder="Ex: 300000"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="interest-price-max">Valor máximo</Label>
                    <Input
                        id="interest-price-max"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={form.price_max}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                price_max: event.target.value,
                            }))
                        }
                        placeholder="Ex: 800000"
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="interest-city">Cidade</Label>
                    <Input
                        id="interest-city"
                        value={form.city}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                city: event.target.value,
                            }))
                        }
                        placeholder="Ex: São Paulo"
                    />
                </div>
            </div>

            <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar perfil de interesse"}
            </Button>
        </form>
    )
}
