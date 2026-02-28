import { z } from "zod"

// ─── Role ────────────────────────────────────────────────────────────────────
export const USER_ROLES = ["owner", "manager", "broker", "assistant"] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Roles allowed to perform destructive ops (delete contacts, properties, etc.) */
export const ADMIN_ROLES: UserRole[] = ["owner", "manager"]
export const isAdmin = (role?: string | null): boolean =>
    ADMIN_ROLES.includes(role as UserRole)

// ─── Contact ─────────────────────────────────────────────────────────────────
export const CONTACT_STATUSES = ["new", "contacted", "qualified", "lost", "won"] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]
export const CONTACT_TYPES = ["lead", "client", "owner"] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export interface Contact {
    id: string
    organization_id: string
    name: string
    email?: string | null
    phone?: string | null
    status: string
    type: string
    assigned_to?: string | null
    notes?: string | null
    created_at?: string
    updated_at?: string
    profiles?: { full_name: string } | null
}

export const contactSchema = z.object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().min(8, "Telefone inválido").optional().or(z.literal("")),
    type: z.string().default("lead"),
    status: z.string().default("new"),
    notes: z.string().optional(),
})
export type ContactFormValues = z.infer<typeof contactSchema>

// ─── Property ────────────────────────────────────────────────────────────────
export const PROPERTY_TYPES = ["apartment", "house", "land", "commercial"] as const
export const PROPERTY_STATUSES = ["available", "sold", "rented"] as const

export interface PropertyFeatures {
    bedrooms: number
    bathrooms: number
    area: number
    [key: string]: unknown
}

export interface PropertyAddress {
    full_address?: string | null
    street?: string | null
    number?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    country?: string | null
    lat?: number | null
    lng?: number | null
    [key: string]: unknown
}

export interface Property {
    id: string
    organization_id: string
    external_id?: string | null
    public_code?: string | null
    title: string
    description?: string | null
    price: number
    type: string
    status: string
    features: PropertyFeatures
    address: PropertyAddress
    images?: string[]
    image_paths?: string[]
    hide_from_site?: boolean
    broker_id?: string | null
    created_at?: string
    updated_at?: string
    profiles?: { full_name: string } | null
}

export const propertySchema = z.object({
    title: z.string().min(5, "Título deve ter pelo menos 5 caracteres"),
    description: z.string().optional(),
    price: z.coerce.number().min(1, "Preço deve ser maior que zero"),
    type: z.string().min(1, "Selecione o tipo do imóvel"),
    status: z.string().default("available"),
    hide_from_site: z.boolean().optional().default(false),
    bedrooms: z.coerce.number().min(0).default(0),
    bathrooms: z.coerce.number().min(0).default(0),
    area: z.coerce.number().min(0).default(0),
    address_street: z.string().optional().or(z.literal("")),
    address_number: z.string().optional().or(z.literal("")),
    address_neighborhood: z.string().optional().or(z.literal("")),
    address_city: z.string().optional().or(z.literal("")),
    address_state: z.string().optional().or(z.literal("")),
    address_zip: z.string().optional().or(z.literal("")),
    address_country: z.string().optional().or(z.literal("")),
    address_full: z.string().optional().or(z.literal("")),
    images: z.array(z.string()).optional(),
})
export type PropertyFormValues = z.infer<typeof propertySchema>

// ─── Appointment ─────────────────────────────────────────────────────────────
export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const

export interface Appointment {
    id: string
    organization_id: string
    property_id?: string | null
    contact_id?: string | null
    broker_id?: string | null
    date: string
    status: string
    notes?: string | null
    created_at?: string
    updated_at?: string
    properties?: { title: string; address?: PropertyAddress | null } | null
    contacts?: { name: string; phone?: string | null; email?: string | null } | null
    profiles?: { full_name: string } | null
}

export const appointmentSchema = z.object({
    property_id: z.string().min(1, "Selecione um imóvel"),
    contact_id: z.string().min(1, "Selecione um contato"),
    date: z.string().min(1, "Selecione a data e hora"),
    notes: z.string().optional(),
    status: z.string().default("scheduled"),
})
export type AppointmentFormValues = z.infer<typeof appointmentSchema>

// ─── Profile / Organization ──────────────────────────────────────────────────
export interface Profile {
    id: string
    organization_id?: string | null
    full_name?: string | null
    role: UserRole
    is_active?: boolean
    avatar_url?: string | null
    created_at?: string
    updated_at?: string
}

export interface Organization {
    id: string
    name: string
    slug: string
    created_at?: string
    updated_at?: string
}

export interface WhatsAppAddonPricingSettings {
    organization_id: string
    addon_enabled: boolean
    included_quota: number
    overage_price: number
    currency_code: string
    billing_timezone: string
}

export interface WhatsAppAddonUsageSnapshot {
    organization_id: string | null
    addon_enabled: boolean
    timezone: string
    period_start: string | null
    period_end: string | null
    included_quota: number
    consumed: number
    balance: number
    usage_percent: number
    alert_level: "ok" | "warning" | "limit" | "disabled"
}

export interface TeamSeatUsage {
    used: number
    seat_limit: number
    available: number
}

export interface TeamMember {
    id: string
    full_name: string | null
    role: UserRole | string
    is_active: boolean
    consumes_seat: boolean
    created_at?: string | null
    updated_at?: string | null
}

export interface TeamInvite {
    id: string
    email: string
    role: UserRole | string
    status: "pending" | "accepted" | "revoked" | "expired" | string
    expires_at?: string | null
    created_at?: string
}

export interface TeamAuditEvent {
    id: string
    action: string
    level: "info" | "warning" | "error" | string
    message?: string | null
    metadata?: Record<string, unknown> | null
    created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Dropdown option used in appointment form selects */
export interface SelectOption {
    id: string
    label: string
}

/** Kanban column definition */
export interface KanbanColumn {
    id: string
    title: string
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
    { id: "new", title: "Novo" },
    { id: "contacted", title: "Contactado" },
    { id: "qualified", title: "Qualificado" },
    { id: "lost", title: "Perdido" },
    { id: "won", title: "Ganho" },
]
