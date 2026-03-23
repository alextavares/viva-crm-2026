"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
    refLabel,
    statusLabel,
    propertyTypeLabel,
    transactionTypeLabel,
    purposeLabel,
    portalSummary
} from "@/components/properties/properties-grid"

import type { PropertyListRow } from "@/components/properties/properties-grid"

interface PropertyRecordSummaryProps {
    property: PropertyListRow & {
        created_at?: string | null
        updated_at?: string | null
        owner_contact?: { id: string; name: string } | null
        broker?: { id: string; full_name: string } | null
    }
}

export function PropertyRecordSummary({ property }: PropertyRecordSummaryProps) {
    if (!property) return null

    const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price || 0)
    
    // Formatting dates
    const createdAt = property.created_at ? new Date(property.created_at).toLocaleDateString('pt-BR') : "Desconhecido"
    const updatedAt = property.updated_at ? new Date(property.updated_at).toLocaleDateString('pt-BR') : "Desconhecido"

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/20 text-sm mb-6">
            {/* Referência & Preço */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Referência (Ref)</span>
                <span className="font-semibold">{refLabel(property)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Preço</span>
                <span className="font-semibold text-primary">{formattedPrice}</span>
            </div>

            {/* Status & Visibilidade */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Status Comercial</span>
                <div className="h-5 flex items-center">
                    <Badge 
                        variant={property.status === 'available' ? 'default' : property.status === 'sold' || property.status === 'rented' ? 'outline' : 'secondary'} 
                        className={`text-[10px] px-1.5 py-0 h-4 ${
                            property.status === 'available' ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                        }`}
                    >
                        {statusLabel(property.status)}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-col gap-1 border-l pl-3">
                <span className="text-xs text-muted-foreground font-medium">Site</span>
                <div className="h-5 flex items-center">
                    <Badge 
                        variant={property.hide_from_site || property.status !== 'available' ? "outline" : "secondary"}
                        className={`text-[10px] px-1.5 py-0 h-4 ${property.hide_from_site || property.status !== 'available' ? "bg-white/90 text-muted-foreground" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`}
                    >
                        {property.hide_from_site || property.status !== 'available' ? "Oculto" : "Publicado"}
                    </Badge>
                </div>
            </div>

            {/* Portais */}
            <div className="flex flex-col gap-1 lg:col-span-2 xl:col-span-1">
                <span className="text-xs text-muted-foreground font-medium">Portais Integrados</span>
                <span className="text-xs font-medium text-foreground">{portalSummary(property)}</span>
            </div>

            {/* Características */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Transação</span>
                <span>{transactionTypeLabel(property.transaction_type)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Uso</span>
                <span>{purposeLabel(property.purpose)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Tipo</span>
                <span>{propertyTypeLabel(property.type)}</span>
            </div>

            {/* Relacionamentos: Proprietário e Corretor */}
            <div className="flex flex-col gap-1 border-l pl-3">
                <span className="text-xs text-muted-foreground font-medium">Proprietário</span>
                {property.owner_contact?.id ? (
                    <Link href={`/contacts/${property.owner_contact.id}`} className="font-medium hover:underline line-clamp-1" title={property.owner_contact.name}>
                        {property.owner_contact.name}
                    </Link>
                ) : (
                    <span className="text-muted-foreground italic text-xs">Não vinculado</span>
                )}
            </div>
            <div className="flex flex-col gap-1 border-l pl-3 lg:col-span-1 xl:col-span-1">
                <span className="text-xs text-muted-foreground font-medium">Corretor Responsável</span>
                {property.broker?.full_name ? (
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {property.broker.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium line-clamp-1">{property.broker.full_name}</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground italic text-xs">Sem atribuição</span>
                )}
            </div>

            {/* Datas */}
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Cadastrado em</span>
                <span className="text-xs">{createdAt}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Atualizado em</span>
                <span className="text-xs">{updatedAt}</span>
            </div>
        </div>
    )
}
