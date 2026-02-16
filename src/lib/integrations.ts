export const PORTALS = ["zap_vivareal", "olx", "imovelweb"] as const
export type PortalKey = (typeof PORTALS)[number]

export const PORTAL_LABEL: Record<PortalKey, string> = {
    zap_vivareal: "ZAP / VivaReal",
    olx: "OLX",
    imovelweb: "Imovelweb",
}

export type IntegrationStatus = "inactive" | "active" | "attention" | "error"

export interface PortalIntegrationRow {
    id: string
    organization_id: string
    portal: PortalKey
    status: IntegrationStatus
    config: Record<string, unknown>
    last_sync_at: string | null
    last_error: string | null
    created_at: string
    updated_at: string
}

export type IntegrationRunKind = "test_feed" | "sync"
export type IntegrationRunStatus = "ok" | "error"

export interface PortalIntegrationRunRow {
    id: string
    organization_id: string
    portal: PortalKey
    kind: IntegrationRunKind
    status: IntegrationRunStatus
    properties_count: number
    bytes: number
    content_type: string | null
    message: string | null
    created_at: string
}

export type IntegrationIssueSeverity = "blocker" | "warning"

export interface PortalIntegrationIssueRow {
    id: string
    organization_id: string
    portal: PortalKey
    property_id: string | null
    severity: IntegrationIssueSeverity
    issue_key: string
    message_human: string
    message_technical: string | null
    is_resolved: boolean
    created_at: string
    resolved_at: string | null
}
