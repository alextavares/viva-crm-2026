"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { createPropertyOwnerContact } from "@/app/actions/properties"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/types"

type OwnerSummary = {
  id: string
  name: string
}

type CreateOwnerInput = {
  name: string
  phone: string
  email: string
}

type PropertyOwnerQuickCreateProps = {
  createOwner?: (input: CreateOwnerInput) => Promise<ActionResult<OwnerSummary>>
  onCreated: (owner: OwnerSummary) => void
  disabled?: boolean
}

export function PropertyOwnerQuickCreate({
  createOwner = createPropertyOwnerContact,
  onCreated,
  disabled = false,
}: PropertyOwnerQuickCreateProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    const result = await createOwner({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    })

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    onCreated(result.data)
    toast.success("Proprietário criado e vinculado ao imóvel.")
    setName("")
    setPhone("")
    setEmail("")
    setIsOpen(false)
    setIsLoading(false)
  }

  return (
    <div className="rounded-lg border border-dashed p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Criar proprietário rápido</div>
          <div className="text-xs text-muted-foreground">
            Cadastre o proprietário sem sair do fluxo do imóvel.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled || isLoading}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo proprietário
        </Button>
      </div>

      {isOpen ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="property-owner-quick-name">Nome</Label>
            <Input
              id="property-owner-quick-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={disabled || isLoading}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="property-owner-quick-phone">Telefone</Label>
              <Input
                id="property-owner-quick-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={disabled || isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-owner-quick-email">Email</Label>
              <Input
                id="property-owner-quick-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={disabled || isLoading}
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={() => void handleSubmit()} disabled={disabled || isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar proprietário
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
