import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"

type HandoffResult =
  | { success: true; brokerId: string; mode: "existing_owner" | "round_robin" }
  | { success: false; error: string }

type LeadAssignNextBrokerResult = Json & {
  assigned?: boolean
  assigned_to?: string
  reason?: string
}

export async function resolveAiHandoffBroker(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contactId: string,
  assignedTo: string | null
): Promise<HandoffResult> {
  if (assignedTo) {
    return { success: true, brokerId: assignedTo, mode: "existing_owner" }
  }

  const { data, error } = await supabase.rpc("lead_assign_next_broker", {
    p_org_id: organizationId,
    p_contact_id: contactId,
    p_reason: "ai_handoff",
    p_force: false,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = (data ?? {}) as LeadAssignNextBrokerResult
  if (!result.assigned || typeof result.assigned_to !== "string") {
    return {
      success: false,
      error: "Nenhum corretor disponível para receber o handoff da IA.",
    }
  }

  return { success: true, brokerId: result.assigned_to, mode: "round_robin" }
}
