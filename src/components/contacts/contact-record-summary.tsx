"use client"

import { Badge } from "@/components/ui/badge"
import { Building, Globe, Home, Mail, MapPin, Phone } from "lucide-react"
import {
    getTypeLabel,
    getStatusLabel,
    getStatusColor,
    buildSlaBadge,
    type LeadDistributionSettings
} from "@/components/contacts/contacts-grid"

interface SiteMeta {
    source: string
    domain: string | null
    lastEventAt: string
}

export interface ContactRecordSummaryProps {
    contactId: string
    name: string
    type: string
    status: string
    email?: string | null
    phone?: string | null
    city?: string | null
    siteMeta?: SiteMeta | null
    latestLeadAt?: string | null
    linkedPropertiesCount?: number
    leadDistributionSettings: LeadDistributionSettings
    leadPropertyContext?: { id: string; title: string } | null
    lastInteraction?: { date: string, description: string, isMessage: boolean } | null
    negotiationStatus?: { label: string, color: 'success' | 'warning' | 'info' | 'default' } | null
    children?: React.ReactNode
}

export function ContactRecordSummary({
    name,
    type,
    status,
    email,
    phone,
    city,
    siteMeta,
    latestLeadAt,
    linkedPropertiesCount,
    leadDistributionSettings,
    leadPropertyContext,
    lastInteraction,
    negotiationStatus,
    children
}: ContactRecordSummaryProps) {
    const optimisticStatus = status
    const slaBadge = buildSlaBadge(latestLeadAt || null, optimisticStatus, leadDistributionSettings)

    return (
        <div className="border rounded-md bg-card p-4 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* 1. Nome, Email, Telefone, Cidade */}
                <div className="flex flex-col gap-1.5 flex-1 w-full min-w-0">
                    <h2 className="text-xl font-semibold truncate" title={name}>{name}</h2>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
                        {phone ? (
                            <span className="text-sm text-foreground flex items-center gap-1.5 font-medium">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {phone}
                            </span>
                        ) : (
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5 italic">
                                <Phone className="h-4 w-4" />
                                Sem telefone
                            </span>
                        )}

                        {email ? (
                            <span className="text-sm text-foreground flex items-center gap-1.5">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate max-w-[200px]" title={email}>{email}</span>
                            </span>
                        ) : (
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5 italic">
                                <Mail className="h-4 w-4" />
                                Sem e-mail
                            </span>
                        )}

                        {city ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                <span className="truncate max-w-[150px]" title={city}>{city}</span>
                            </span>
                        ) : (
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                -
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Tipo, Status, Origem, SLA, Imóveis */}
                <div className="flex flex-wrap lg:justify-end gap-x-4 gap-y-2 lg:min-w-[400px]">
                    <div className="flex flex-col gap-2 min-w-[140px]">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${type === 'lead' ? 'text-primary' : type === 'owner' ? 'text-purple-600' : 'text-muted-foreground'}`}>
                                {getTypeLabel(type)}
                            </span>
                            <Badge variant={getStatusColor(optimisticStatus) as "default" | "secondary" | "destructive" | "outline"} className="whitespace-nowrap">
                                {getStatusLabel(optimisticStatus)}
                            </Badge>
                            {negotiationStatus && (
                                <Badge 
                                    variant="outline" 
                                    className={`whitespace-nowrap border-2 ${
                                        negotiationStatus.color === 'success' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 
                                        negotiationStatus.color === 'warning' ? 'border-amber-500 text-amber-700 bg-amber-50' : 
                                        negotiationStatus.color === 'info' ? 'border-blue-500 text-blue-700 bg-blue-50' : 
                                        'border-muted-foreground'
                                    }`}
                                >
                                    {negotiationStatus.label}
                                </Badge>
                            )}
                        </div>

                        {type === 'owner' && (
                            <div className="text-xs font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full inline-flex w-max">
                                {linkedPropertiesCount === 1 
                                    ? "1 imóvel vinculado" 
                                    : `${linkedPropertiesCount || 0} imóveis vinculados`}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[150px]">
                        {siteMeta ? (
                            <div className="flex items-center gap-1.5 text-sm text-foreground">
                                {siteMeta.source === 'site' ? (
                                    <>
                                        <Badge variant="secondary" className="px-1.5 text-[10px] h-4">Site</Badge>
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="truncate max-w-[120px]">{siteMeta.domain || "Geral"}</span>
                                    </>
                                ) : (
                                    <Badge variant="outline" className="px-1.5 text-[10px] h-4 capitalize">
                                        {siteMeta.source || "Origem"}
                                    </Badge>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Building className="h-3.5 w-3.5" />
                                <span>Origem não informada</span>
                            </div>
                        )}

                        {lastInteraction && (
                            <div className="flex items-center gap-1.5 text-sm">
                                <span className="text-muted-foreground whitespace-nowrap">Último contato:</span>
                                <span className={`font-medium whitespace-nowrap ${lastInteraction.isMessage ? 'text-emerald-600' : 'text-foreground'}`}>
                                    {lastInteraction.description}
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap text-xs ml-1">
                                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(lastInteraction.date))}
                                </span>
                            </div>
                        )}

                        {slaBadge && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap w-max ${slaBadge.className}`}>
                                SLA: {slaBadge.label}
                            </span>
                        )}

                        {leadPropertyContext && (
                            <a
                                href={`/properties/${leadPropertyContext.id}`}
                                className="flex items-center gap-1.5 text-sm text-primary hover:underline truncate max-w-[220px]"
                                title={leadPropertyContext.title}
                            >
                                <Home className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{leadPropertyContext.title}</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {children && (
                <div className="flex items-center gap-2 mt-2 pt-4 border-t lg:justify-end">
                    {children}
                </div>
            )}
        </div>
    )
}
