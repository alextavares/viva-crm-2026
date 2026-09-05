import type { SupabaseClient } from "@supabase/supabase-js"

export type CanonicalPortalStatus = "enabled" | "disabled"

/**
 * Canonical portal_integrations.status values are
 * enabled/disabled/error. Reads bridge the legacy `active` value so
 * pre-migration rows keep resolving until an owner re-saves.
 */
export function toCanonicalPortalStatus(enabled: boolean): CanonicalPortalStatus {
  return enabled ? "enabled" : "disabled"
}

export function isPortalIntegrationActive(status: unknown): boolean {
  return status === "enabled" || status === "active"
}

/** Portal key → credential provider name in private.integration_credentials. */
export function portalCredentialProvider(portal: string): string {
  return portal === "zap_vivareal" ? "zap_vivareal" : portal
}

/**
 * Provider gate: only portals with a canonical verifier may provision
 * credentials. ImovelWeb verifies via api.imovelweb_feed/ingest; Zap has no
 * verifier contract, so provisioning (and enabling) is refused — parking Zap
 * instead of issuing secrets nothing consumes.
 */
export function canProvisionPortalCredentials(portal: string): boolean {
  return portalCredentialProvider(portal) === "imovelweb"
}

const SECRET_CONFIG_KEYS = ["feed_token", "webhook_token", "access_token", "secret", "password"] as const

/**
 * Strip secret material from a portal_integrations.config object. The
 * canonical contract forbids these keys server-side; this keeps writers from
 * persisting them in the first place. Non-secret display/operational config
 * passes through untouched.
 */
export function stripSecretConfigKeys(config: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config ?? {})) {
    if ((SECRET_CONFIG_KEYS as readonly string[]).includes(key)) continue
    clean[key] = value
  }
  return clean
}

export type PortalCredentialRotation = {
  feedSecretOnce: string
  webhookSecretOnce: string
  feedLast4: string
  webhookLast4: string
}

type RotationResult = { ok: true; rotation: PortalCredentialRotation } | { ok: false; error: string }

/**
 * Provision distinct feed and webhook credentials via the canonical
 * `api.rotate_integration_credential` RPC (purposes `feed_auth` /
 * `webhook_auth`). Secrets are returned ONCE for the owner to configure at
 * the portal; only `last4` fingerprints are safe to persist in
 * `portal_integrations.config`. The caller runs with the owner's session, so
 * the RPC's owner/manager guard applies.
 */
export async function rotatePortalCredentials(
  supabase: SupabaseClient,
  portal: string
): Promise<RotationResult> {
  if (!canProvisionPortalCredentials(portal)) {
    return {
      ok: false,
      error: "Zap/VivaReal está pausado até que um contrato canônico de verificação seja autorizado; nenhum segredo foi gerado.",
    }
  }
  const provider = portalCredentialProvider(portal)

  const { data: feed, error: feedError } = await supabase.schema("api").rpc("rotate_integration_credential", {
    p_provider: provider,
    p_purpose: "feed_auth",
  })
  if (feedError) {
    return { ok: false, error: feedError.message || "Não foi possível gerar a credencial do feed." }
  }
  const { data: webhook, error: webhookError } = await supabase.schema("api").rpc("rotate_integration_credential", {
    p_provider: provider,
    p_purpose: "webhook_auth",
  })
  if (webhookError) {
    return { ok: false, error: webhookError.message || "Não foi possível gerar a credencial do webhook." }
  }

  const feedRow = (Array.isArray(feed) ? feed[0] : feed) as
    | { secret_once?: string; last4?: string }
    | null
  const webhookRow = (Array.isArray(webhook) ? webhook[0] : webhook) as
    | { secret_once?: string; last4?: string }
    | null

  if (!feedRow?.secret_once || !webhookRow?.secret_once) {
    return { ok: false, error: "Credenciais geradas sem segredo utilizável." }
  }

  return {
    ok: true,
    rotation: {
      feedSecretOnce: feedRow.secret_once,
      webhookSecretOnce: webhookRow.secret_once,
      feedLast4: feedRow.last4 ?? "",
      webhookLast4: webhookRow.last4 ?? "",
    },
  }
}
