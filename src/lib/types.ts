import { z } from "zod"

export type ActionResult<T = void> =
    | (T extends void ? { success: true; data?: T } : { success: true; data: T })
    | { success: false; error: string }

export const PROPERTY_PORTAL_BULK_ACTIONS = [
    "enable_all_portals",
    "disable_all_portals",
    "enable_imovelweb",
    "enable_zap",
    "enable_olx",
] as const
export type PropertyPortalBulkAction = (typeof PROPERTY_PORTAL_BULK_ACTIONS)[number]

export type BulkPropertyMutationSummary = {
    requestedCount: number
    updatedCount: number
}

export type BulkPropertyEnrichmentSummary = {
    requestedCount: number
    updatedCount: number
    skippedCount: number
}

export type PropertyImportBatchSummary = {
    requestedCount: number
    createdCount: number
    updatedCount: number
    errorCount: number
}

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
    city?: string | null
    deal_stage?: string | null
    interest_type?: string | null
    interest_bedrooms?: number | null
    interest_price_max?: number | null
    status: string
    type: string
    ai_status?: string | null
    ai_score?: number | null
    ai_last_summary?: string | null
    qualified_by_ai_at?: string | null
    handoff_to_profile_id?: string | null
    handoff_at?: string | null
    assigned_to?: string | null
    notes?: string | null
    created_at?: string
    updated_at?: string
    profiles?: { full_name: string } | null
}

// ─── Property ────────────────────────────────────────────────────────────────
export const PROPERTY_TYPES = [
    "apartment",
    "house",
    "condominium_house",
    "land",
    "commercial",
    "commercial_space",
] as const
export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number]
export const DEFAULT_PROPERTY_TYPE: PropertyTypeValue = "apartment"

type PropertyTypeCategory = "residential" | "land" | "commercial"

type PropertyTypeDefinition = {
    label: string
    marketingLabel: string
    category: PropertyTypeCategory
    requiresBedrooms: boolean
    requiresBathrooms: boolean
}

const PROPERTY_TYPE_DEFINITIONS: Record<PropertyTypeValue, PropertyTypeDefinition> = {
    apartment: {
        label: "Apartamento",
        marketingLabel: "Apartamento",
        category: "residential",
        requiresBedrooms: true,
        requiresBathrooms: true,
    },
    house: {
        label: "Casa",
        marketingLabel: "Casa",
        category: "residential",
        requiresBedrooms: true,
        requiresBathrooms: true,
    },
    condominium_house: {
        label: "Casa em condomínio",
        marketingLabel: "Casa em condomínio",
        category: "residential",
        requiresBedrooms: true,
        requiresBathrooms: true,
    },
    land: {
        label: "Terreno",
        marketingLabel: "Terreno",
        category: "land",
        requiresBedrooms: false,
        requiresBathrooms: false,
    },
    commercial: {
        label: "Comercial",
        marketingLabel: "Imóvel comercial",
        category: "commercial",
        requiresBedrooms: false,
        requiresBathrooms: false,
    },
    commercial_space: {
        label: "Espaço comercial",
        marketingLabel: "Imóvel comercial",
        category: "commercial",
        requiresBedrooms: false,
        requiresBathrooms: false,
    },
}

export const PROPERTY_TYPE_OPTIONS = PROPERTY_TYPES.map((value) => ({
    value,
    label: PROPERTY_TYPE_DEFINITIONS[value].label,
}))

export function isKnownPropertyType(type?: string | null): type is PropertyTypeValue {
    return PROPERTY_TYPES.includes((type ?? "") as PropertyTypeValue)
}

function getPropertyTypeDefinition(type?: string | null) {
    if (!isKnownPropertyType(type)) return null
    return PROPERTY_TYPE_DEFINITIONS[type]
}

export function getPropertyTypeLabel(type?: string | null, fallback = "Tipo não informado") {
    return getPropertyTypeDefinition(type)?.label ?? (type?.trim() || fallback)
}

export function getPropertyTypeMarketingLabel(type?: string | null, fallback = "Imóvel") {
    return getPropertyTypeDefinition(type)?.marketingLabel ?? fallback
}

export function getPropertyTypeCategory(type?: string | null): PropertyTypeCategory | null {
    return getPropertyTypeDefinition(type)?.category ?? null
}

export function propertyTypeRequiresBedrooms(type?: string | null) {
    return Boolean(getPropertyTypeDefinition(type)?.requiresBedrooms)
}

export function propertyTypeRequiresBathrooms(type?: string | null) {
    return Boolean(getPropertyTypeDefinition(type)?.requiresBathrooms)
}

export const contactSchema = z.object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().min(8, "Telefone inválido").optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    type: z.string(),
    status: z.string(),
    interest_type: z.enum(PROPERTY_TYPES).optional().or(z.literal("")),
    interest_bedrooms: z.number().int().min(0).nullable().optional(),
    interest_price_max: z.number().min(0).nullable().optional(),
    notes: z.string().optional(),
})
export type ContactFormValues = z.infer<typeof contactSchema>

const emptyStringToUndefined = (value: unknown) => {
    if (typeof value === "string" && value.trim() === "") return undefined
    return value
}

export const interestProfileSchema = z.object({
    transaction: z.preprocess(
        emptyStringToUndefined,
        z.enum(["sale", "rent", "both"]).optional()
    ),
    property_type: z.preprocess(
        emptyStringToUndefined,
        z.enum(["apartment", "house", "land", "commercial"]).optional()
    ),
    price_min: z.preprocess(
        emptyStringToUndefined,
        z.coerce.number().nonnegative().optional()
    ),
    price_max: z.preprocess(
        emptyStringToUndefined,
        z.coerce.number().nonnegative().optional()
    ),
    city: z.preprocess(
        emptyStringToUndefined,
        z.string().trim().max(120).optional()
    ),
})
export type InterestProfile = z.infer<typeof interestProfileSchema>

// ─── Deals / Proposals ──────────────────────────────────────────────────────
export const DEAL_STAGES = [
    "lead",
    "interest",
    "visit",
    "negotiation",
    "closing",
    "won",
    "lost",
] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
    lead: "Lead",
    interest: "Interesse",
    visit: "Visita",
    negotiation: "Negociação",
    closing: "Fechamento",
    won: "Ganho",
    lost: "Perdido",
}

export const OPPORTUNITY_STAGES = [
    "new",
    "qualified",
    "visit",
    "negotiation",
    "proposal",
    "won",
    "lost",
] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
    new: "Nova",
    qualified: "Qualificada",
    visit: "Visita",
    negotiation: "Negociação",
    proposal: "Proposta",
    won: "Ganha",
    lost: "Perdida",
}

export const PROPOSAL_STATUSES = ["pending", "accepted", "rejected", "counter_offer"] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export interface DealProposal {
    id: string
    organization_id: string
    contact_id: string
    assigned_to?: string | null
    property_id?: string | null
    proposed_value: number
    payment_conditions?: string | null
    valid_until?: string | null
    status: ProposalStatus | string
    notes?: string | null
    created_at?: string | null
    updated_at?: string | null
    properties?: { title: string | null; public_code?: string | null } | null
}

export const proposalSchema = z.object({
    property_id: z.string().optional().or(z.literal("")),
    proposed_value: z.coerce.number().min(0, "Informe um valor válido"),
    payment_conditions: z.string().optional().or(z.literal("")),
    valid_until: z.string().optional().or(z.literal("")),
    assigned_to: z.string().optional().or(z.literal("")),
    status: z.enum(PROPOSAL_STATUSES).default("pending"),
    notes: z.string().optional().or(z.literal("")),
})
export type ProposalFormValues = z.infer<typeof proposalSchema>

export function canCreateProposalForContact(
    role: string | null | undefined,
    userId: string | null | undefined,
    contactAssignedTo: string | null | undefined
) {
    if (role === "owner" || role === "manager") return true
    return role === "broker" && Boolean(userId) && contactAssignedTo === userId
}

export function canEditProposalRecord(
    role: string | null | undefined,
    userId: string | null | undefined,
    proposalAssignedTo: string | null | undefined
) {
    if (role === "owner" || role === "manager") return true
    return role === "broker" && Boolean(userId) && proposalAssignedTo === userId
}

export function canDeleteProposalRecord(role: string | null | undefined) {
    return role === "owner" || role === "manager"
}

export function canEditContactDealStage(
    role: string | null | undefined,
    userId: string | null | undefined,
    contactAssignedTo: string | null | undefined
) {
    if (role === "owner" || role === "manager") return true
    return role === "broker" && Boolean(userId) && contactAssignedTo === userId
}

export function isTerminalDealStage(stage: string | null | undefined): stage is "won" | "lost" {
    return stage === "won" || stage === "lost"
}

export const PROPERTY_STATUSES = ["available", "sold", "rented"] as const
export const PROPERTY_TRANSACTION_TYPES = ["sale", "rent", "seasonal"] as const

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
    transaction_type?: string | null
    status: string
    features: PropertyFeatures
    address: PropertyAddress
    images?: string[]
    image_paths?: string[]
    hide_from_site?: boolean
    owner_name?: string | null
    owner_contact_id?: string | null
    publish_to_portals?: boolean
    publish_zap?: boolean
    publish_imovelweb?: boolean
    publish_olx?: boolean
    assigned_to?: string | null
    created_at?: string
    updated_at?: string
    profiles?: { full_name: string } | null
}

export const propertySchema = z.object({
    title: z.string().min(5, "Título deve ter pelo menos 5 caracteres"),
    description: z.string().optional(),
    price: z.coerce.number().min(1, "Preço deve ser maior que zero"),
    type: z.string().min(1, "Selecione o tipo do imóvel"),
    transaction_type: z.string().default("sale"),
    assigned_to: z.string().optional().or(z.literal("")),
    owner_contact_id: z.string().optional().or(z.literal("")),
    status: z.string().default("available"),
    hide_from_site: z.boolean().optional().default(false),
    publish_to_portals: z.boolean().optional().default(false),
    publish_zap: z.boolean().optional().default(false),
    publish_imovelweb: z.boolean().optional().default(false),
    publish_olx: z.boolean().optional().default(false),
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
    assigned_to?: string | null
    starts_at: string
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
    starts_at: z.string().min(1, "Selecione a data e hora"),
    notes: z.string().optional(),
    status: z.enum(APPOINTMENT_STATUSES).default("scheduled"),
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
    creci?: string | null
    public_whatsapp?: string | null
    public_profile_enabled?: boolean
    public_display_name?: string | null
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
    avatar_url?: string | null
    creci?: string | null
    public_whatsapp?: string | null
    public_profile_enabled?: boolean
    public_display_name?: string | null
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

// ─── Contracts & Templates ───────────────────────────────────────────────────
export interface DealContract {
    id: string
    organization_id: string
    property_id?: string | null
    contact_id?: string | null
    assigned_to?: string | null
    proposal_id?: string | null
    contract_type?: string | null
    final_value: number
    commission_value?: number | null
    status: string
    start_date?: string | null
    end_date?: string | null
    document_url?: string | null
    created_at?: string
    updated_at?: string
    properties?: { title?: string | null; public_code?: string | null } | null
    contacts?: { name?: string | null; email?: string | null; phone?: string | null } | null
    profiles?: { full_name?: string | null } | null
}

const nullableOptionalString = z.string().nullish().transform((value) => value ?? "")

export const contractSchema = z.object({
    id: z.string().optional(),
    organization_id: z.string().optional(),
    property_id: z.string().min(1, "Selecione um imóvel"),
    contact_id: z.string().min(1, "Selecione um contato"),
    assigned_to: nullableOptionalString,
    proposal_id: nullableOptionalString,
    contract_type: z.string().default("sale"),
    final_value: z.coerce.number().min(0).default(0),
    commission_value: z.coerce.number().min(0).nullable().optional(),
    status: z.string().default("draft"),
    start_date: nullableOptionalString,
    end_date: nullableOptionalString,
    document_url: nullableOptionalString,
})
export type ContractFormValues = z.infer<typeof contractSchema>

export interface MessageTemplate {
    id: string
    organization_id: string
    title: string
    content: string
    channel: string
    variables?: string[] | null
    created_at?: string
    updated_at?: string
}

export const messageTemplateSchema = z.object({
    title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
    content: z.string().min(5, "Conteúdo deve ter pelo menos 5 caracteres"),
    channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
    variables: z.array(z.string()).optional(),
})
export type MessageTemplateFormValues = z.infer<typeof messageTemplateSchema>

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
    { id: "contacted", title: "Em atendimento" },
    { id: "qualified", title: "Qualificado" },
    { id: "lost", title: "Perdido" },
    { id: "won", title: "Ganho" },
]
