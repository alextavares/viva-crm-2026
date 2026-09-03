"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/types"

export async function markAllNotificationsRead(): Promise<
  ActionResult<{ markedCount: number; readAt: string }>
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Não autenticado." }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return { success: false, error: "Sem permissão para gerenciar notificações." }
  }

  const organizationId = profile.organization_id

  const { data: unreadRows, error: unreadError } = await supabase
    .from("notifications")
    .select("id, read_at")
    .eq("organization_id", organizationId)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .is("read_at", null)

  if (unreadError) {
    return { success: false, error: unreadError.message }
  }

  const unreadIds = (unreadRows ?? []).map((row) => row.id)
  if (unreadIds.length === 0) {
    return {
      success: true,
      data: {
        markedCount: 0,
        readAt: new Date().toISOString(),
      },
    }
  }

  const readAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("notifications")
    .update({ read_at: readAt })
    .eq("organization_id", organizationId)
    .in("id", unreadIds)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return {
    success: true,
    data: {
      markedCount: unreadIds.length,
      readAt,
    },
  }
}
