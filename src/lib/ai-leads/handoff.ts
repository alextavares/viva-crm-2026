import type { SupabaseClient } from "@supabase/supabase-js"

export type HandoffResult =
  | { success: true; brokerId: string; mode: "existing_owner" | "round_robin" | "default_assignee" }
  | { success: false; error: string }

/**
 * Canonical AI handoff assignment. The legacy `lead_assign_next_broker` RPC no
 * longer exists; assignment honors `lead_distribution_settings` directly:
 * - contact already owned → keep owner;
 * - mode `default` with a configured broker → that broker (verified active);
 * - mode `round_robin` → the active broker with the fewest open contacts
 *   (load-aware; the legacy atomic cursor in `private.lead_distribution_state`
 *   is not reachable over PostgREST, so strict rotation is a contract gap);
 * - mode `manual`/disabled → refuse with an explicit error.
 */
export async function resolveAiHandoffBroker(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  assignedTo: string | null
): Promise<HandoffResult> {
  if (assignedTo) {
    return { success: true, brokerId: assignedTo, mode: "existing_owner" }
  }

  const { data: settings } = await supabase
    .from("lead_distribution_settings")
    .select("enabled, mode, default_assigned_to")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!settings?.enabled || settings.mode === "manual") {
    return { success: false, error: "Distribuição automática de leads desativada." }
  }

  const { data: brokers } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "broker")
    .eq("is_active", true)

  const brokerIds = (brokers ?? []).map((b) => b.id as string)
  if (brokerIds.length === 0) {
    return { success: false, error: "Nenhum corretor disponível para receber o handoff da IA." }
  }

  let picked: string | null = null
  if (settings.mode === "default" && typeof settings.default_assigned_to === "string") {
    if (brokerIds.includes(settings.default_assigned_to)) {
      picked = settings.default_assigned_to
    }
  }

  if (!picked) {
    const { data: load } = await supabase
      .from("contacts")
      .select("assigned_to")
      .eq("organization_id", organizationId)
      .in("status", ["new", "contacted", "qualified"])
      .in("assigned_to", brokerIds)
    const counts = new Map<string, number>()
    for (const row of (load ?? []) as Array<{ assigned_to: string | null }>) {
      if (row.assigned_to) counts.set(row.assigned_to, (counts.get(row.assigned_to) ?? 0) + 1)
    }
    picked = [...brokerIds].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0] ?? null
  }

  if (!picked) {
    return { success: false, error: "Nenhum corretor disponível para receber o handoff da IA." }
  }

  const { error: assignError } = await supabase
    .from("contacts")
    .update({ assigned_to: picked })
    .eq("organization_id", organizationId)
    .eq("id", contactId)

  if (assignError) {
    return { success: false, error: assignError.message }
  }

  return {
    success: true,
    brokerId: picked,
    mode: settings.mode === "default" ? "default_assignee" : "round_robin",
  }
}
