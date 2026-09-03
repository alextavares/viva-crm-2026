"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ContactActions } from "@/components/contacts/contact-card-actions"
import { DealStageBadge } from "@/components/contacts/deal-stage-badge"
import { SiteContactQuickActions } from "@/components/contacts/site-contact-quick-actions"
import { Building, Globe, Mail, Phone } from "lucide-react"

export type EnrichedContactRow = {
    id: string
    name: string
    email: string | null
    phone: string | null
    status: string
    type: string
    deal_stage?: string | null
    assigned_to?: string | null
    organization_id: string
    city?: string | null
    created_at: string | null
    updated_at?: string | null
    siteMeta?: {
        source: string | null
        domain: string | null
        lastEventAt: string | null
    } | null
    latestLeadAt?: string | null
    assignedProfileName?: string | null
    leadPropertyContext?: {
        id: string
        title: string
    } | null
}

export type LeadDistributionSettings = {
    sla_minutes: number
    enabled: boolean
}

type SlaBadgeInfo = {
    label: string
    elapsed: string
    className: string
}

export function getTypeLabel(type: string) {
    switch (type) {
        case "lead":
            return "Lead"
        case "client":
            return "Cliente"
        case "owner":
            return "Proprietário"
        case "partner":
            return "Parceiro"
        default:
            return type
    }
}

export function getStatusLabel(status: string) {
    switch (status) {
        case "new":
            return "Novo"
        case "contacted":
            return "Em atendimento"
        case "qualified":
            return "Qualificado"
        case "lost":
            return "Perdido"
        case "won":
            return "Ganho"
        default:
            return status
    }
}

export function getStatusColor(status: string) {
    switch (status) {
        case "new":
            return "default"
        case "contacted":
            return "secondary"
        case "qualified":
            return "secondary"
        case "won":
            return "default"
        case "lost":
            return "destructive"
        default:
            return "outline"
    }
}

export function getContactSourceLabel(source: string | null) {
    if (!source) return "Origem externa"

    switch (source) {
        case "site":
            return "Site"
        case "whatsapp":
            return "WhatsApp"
        case "imovelweb":
            return "Imovelweb"
        case "zap":
            return "ZAP"
        default:
            return source
                .replace(/[_-]+/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase())
    }
}

export function getContactDomainLabel(domain: string | null) {
    const normalizedDomain = domain?.trim()
    return normalizedDomain ? normalizedDomain : "Sem domínio"
}

export function formatDateTime(value: string) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

export function buildSlaBadge(lastLeadAt: string | null, status: string, settings: LeadDistributionSettings): SlaBadgeInfo | null {
    if (!lastLeadAt || status !== "new" || !settings.enabled) return null

    const dt = new Date(lastLeadAt)
    if (Number.isNaN(dt.getTime())) return null

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000))
    const slaMinutes = Math.max(1, settings.sla_minutes || 15)
    const warnThreshold = Math.max(1, Math.floor(slaMinutes * 0.66))

    if (elapsedMinutes <= warnThreshold) {
        return {
            label: "No prazo",
            elapsed: `${elapsedMinutes} min`,
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
    }

    if (elapsedMinutes <= slaMinutes) {
        return {
            label: "Atenção",
            elapsed: `${elapsedMinutes} min`,
            className: "border-amber-200 bg-amber-50 text-amber-700",
        }
    }

    return {
        label: "Atrasado",
        elapsed: `${elapsedMinutes} min`,
        className: "border-rose-200 bg-rose-50 text-rose-700",
    }
}

export function ContactsGrid({
    contacts,
    leadDistributionSettings
}: {
    contacts: EnrichedContactRow[]
    leadDistributionSettings: LeadDistributionSettings
}) {
    if (!contacts || contacts.length === 0) return null

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {contacts.map(contact => (
                <ContactCard
                    key={contact.id}
                    contact={contact}
                    leadDistributionSettings={leadDistributionSettings}
                />
            ))}
        </div>
    )
}

function ContactCard({
    contact,
    leadDistributionSettings
}: {
    contact: EnrichedContactRow
    leadDistributionSettings: LeadDistributionSettings
}) {
    const [isDeleted, setIsDeleted] = useState(false)
    const [optimisticStatus, setOptimisticStatus] = useState<string>(contact.status)

    if (isDeleted) return null

    const slaBadge = buildSlaBadge(contact.latestLeadAt || null, optimisticStatus, leadDistributionSettings)
    const siteMeta = contact.siteMeta

    return (
        <div className="relative group">
            <Link href={`/contacts/${contact.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Avatar>
                            <AvatarImage src={`https://ui-avatars.com/api/?name=${contact.name}&background=random`} />
                            <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <CardTitle className="text-base">{contact.name}</CardTitle>
                            {contact.type !== "lead" ? (
                                <p className="text-xs text-muted-foreground">{getTypeLabel(contact.type)}</p>
                            ) : null}
                        </div>
                        <div className="ml-auto flex flex-col items-end gap-1">
                            <Badge
                                variant={getStatusColor(optimisticStatus) as "default" | "secondary" | "destructive" | "outline"}
                            >
                                {getStatusLabel(optimisticStatus)}
                            </Badge>
                            <DealStageBadge stage={contact.deal_stage} className="text-[10px] px-2 py-0.5" />
                            {slaBadge ? (
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${slaBadge.className}`}>
                                    SLA: {slaBadge.label} ({slaBadge.elapsed})
                                </span>
                            ) : null}
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                        {contact.email ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <span className="truncate">{contact.email}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground italic">
                                <Mail className="h-4 w-4" />
                                <span>Sem email</span>
                            </div>
                        )}
                        {contact.phone ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <span>{contact.phone}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground italic">
                                <Phone className="h-4 w-4" />
                                <span>Sem telefone</span>
                            </div>
                        )}
                        {siteMeta ? (
                            siteMeta.source === 'site' ? (
                                <div className="mt-2 space-y-2 border-t pt-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary">Site</Badge>
                                        <Globe className="h-3 w-3" />
                                        <span className="truncate">{getContactDomainLabel(siteMeta.domain)}</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <div className="font-medium text-foreground">
                                            Imóvel: {contact.leadPropertyContext?.title || "Interesse não identificado"}
                                        </div>
                                        <div className="text-muted-foreground">
                                            Responsável: {contact.assignedProfileName || "Sem responsável"}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                                    <Badge variant="outline">
                                        {getContactSourceLabel(siteMeta.source)}
                                    </Badge>
                                </div>
                            )
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t">
                                <Building className="h-3 w-3" />
                                <span>Cadastro direto</span>
                            </div>
                        )}
                        {siteMeta?.lastEventAt ? (
                            <div className="text-xs text-muted-foreground">
                                Último lead: {formatDateTime(siteMeta.lastEventAt)}
                            </div>
                        ) : null}

                        {siteMeta && (
                            <SiteContactQuickActions
                                contactId={contact.id}
                                phone={contact.phone}
                                status={optimisticStatus}
                                contactName={contact.name}
                                propertyTitle={contact.leadPropertyContext?.title ?? null}
                                onOptimisticUpdate={(newStatus: string) => setOptimisticStatus(newStatus)}
                                onRevertUpdate={() => setOptimisticStatus(contact.status)}
                            />
                        )}
                    </CardContent>
                </Card>
            </Link>
            <ContactActions
                contactId={contact.id}
                onOptimisticDelete={() => setIsDeleted(true)}
                onRevertDelete={() => setIsDeleted(false)}
            />
        </div>
    )
}
