"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ContactActions } from "@/components/contacts/contact-card-actions"
import { DealStageBadge } from "@/components/contacts/deal-stage-badge"
import { ContactListPrimaryAction } from "@/components/contacts/contact-list-primary-action"
import { Building, Globe, MapPin, Phone, Mail, ChevronRight } from "lucide-react"

import {
    getContactDomainLabel,
    type EnrichedContactRow,
    type LeadDistributionSettings,
    getContactSourceLabel,
    getTypeLabel,
    getStatusLabel,
    getStatusColor,
    formatDateTime,
    buildSlaBadge
} from "@/components/contacts/contacts-grid"

export function ContactsList({
    contacts,
    leadDistributionSettings
}: {
    contacts: EnrichedContactRow[]
    leadDistributionSettings: LeadDistributionSettings
}) {
    if (!contacts || contacts.length === 0) return null

    return (
        <div className="flex flex-col gap-0 border rounded-md bg-card overflow-hidden">
            {contacts.map((contact, index) => (
                <ContactListRow
                    key={contact.id}
                    contact={contact}
                    leadDistributionSettings={leadDistributionSettings}
                    isLast={index === contacts.length - 1}
                />
            ))}
        </div>
    )
}

function ContactListRow({
    contact,
    leadDistributionSettings,
    isLast
}: {
    contact: EnrichedContactRow
    leadDistributionSettings: LeadDistributionSettings
    isLast: boolean
}) {
    const [isDeleted, setIsDeleted] = useState(false)
    const [optimisticStatus, setOptimisticStatus] = useState<string>(contact.status)

    if (isDeleted) return null

    const slaBadge = buildSlaBadge(contact.latestLeadAt || null, optimisticStatus, leadDistributionSettings)
    const siteMeta = contact.siteMeta

    return (
        <div className={`relative group flex flex-col ${isLast ? '' : 'border-b'} hover:bg-muted/50 transition-colors`}>
            <Link href={`/contacts/${contact.id}`} className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 pr-10">
                {/* 1. Avatar + Nome + Email */}
                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} />
                        <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate text-base">{contact.name}</span>
                        {contact.email ? (
                            <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground italic truncate flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Sem email
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Tipo + Telefone + Local */}
                <div className="flex flex-col gap-1.5 min-w-[140px]">
                    <div className="flex items-center gap-2">
                        {contact.type !== 'lead' ? (
                            <span className={`text-xs font-semibold ${contact.type === 'owner' ? 'text-purple-600' : 'text-muted-foreground'}`}>
                                {getTypeLabel(contact.type)}
                            </span>
                        ) : null}
                        {contact.city ? (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded-sm flex items-center gap-1 border">
                                <MapPin className="h-3 w-3" />
                                {contact.city}
                            </span>
                        ) : (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded-sm flex items-center gap-1 border italic">
                                <MapPin className="h-3 w-3" />
                                Sem cidade
                            </span>
                        )}
                    </div>
                    {contact.phone ? (
                        <span className="text-xs text-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {contact.phone}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Sem telefone
                        </span>
                    )}
                </div>

                {/* 3. Status + Funil + SLA */}
                <div className="flex flex-col items-start lg:items-center gap-1.5 min-w-[180px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={getStatusColor(optimisticStatus) as "default" | "secondary" | "destructive" | "outline"} className="whitespace-nowrap">
                            {getStatusLabel(optimisticStatus)}
                        </Badge>
                        <DealStageBadge stage={contact.deal_stage} className="text-[10px] px-2 py-0.5" />
                    </div>
                    {slaBadge && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${slaBadge.className}`}>
                            SLA: {slaBadge.label}
                        </span>
                    )}
                </div>

                {/* 4. Origem / Contexto */}
                <div className="flex flex-col min-w-[160px] gap-1.5">
                    {siteMeta ? (
                        siteMeta.source === 'site' ? (
                            <>
                                <div className="flex items-center gap-1.5 text-xs text-foreground">
                                    <Badge variant="secondary" className="px-1.5 text-[10px] h-4">Site</Badge>
                                    <Globe className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate max-w-[100px]">{getContactDomainLabel(siteMeta.domain)}</span>
                                </div>
                                {siteMeta.lastEventAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                        Último lead: {formatDateTime(siteMeta.lastEventAt)}
                                    </span>
                                )}
                                <span className="text-xs font-medium text-foreground truncate" title={contact.leadPropertyContext?.title || undefined}>
                                    Imóvel: {contact.leadPropertyContext?.title || "Interesse não identificado"}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate" title={contact.assignedProfileName || undefined}>
                                    Responsável: {contact.assignedProfileName || "Sem responsável"}
                                </span>
                            </>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Badge variant="outline" className="px-1.5 text-[10px] h-4">
                                    {getContactSourceLabel(siteMeta.source)}
                                </Badge>
                                {siteMeta.lastEventAt && (
                                    <span className="text-[10px]">
                                        {formatDateTime(siteMeta.lastEventAt)}
                                    </span>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            <span>Cadastro direto</span>
                        </div>
                    )}
                </div>

                {/* 5. Ação Principal da Lista */}
                <div className="flex items-center justify-between lg:justify-end gap-3 min-w-[120px] lg:ml-auto">
                    <ContactListPrimaryAction
                        contactId={contact.id}
                        type={contact.type}
                        status={optimisticStatus}
                        onOptimisticUpdate={(newStatus) => setOptimisticStatus(newStatus)}
                        onRevertUpdate={() => setOptimisticStatus(contact.status)}
                    />
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity hidden lg:block" />
                </div>
            </Link>

            {/* 
              ContactActions already tem `absolute top-2 right-2` embutido.
              Renderizado direto na raiz do card para evitar duplicação de absolute.
            */}
            <ContactActions
                contactId={contact.id}
                onOptimisticDelete={() => setIsDeleted(true)}
                onRevertDelete={() => setIsDeleted(false)}
            />
        </div>
    )
}
