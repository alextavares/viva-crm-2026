import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { deriveStoragePathsForBucket } from "@/lib/media"
import type { PropertyImportBatchSummary } from "@/lib/types"

const importedPropertySchema = z.object({
  external_id: z.string().min(1, "External ID é obrigatório."),
  title: z.string().min(1, "Título é obrigatório."),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  type: z.string().min(1, "Tipo é obrigatório."),
  status: z.string().min(1, "Status é obrigatório."),
  transaction_type: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  built_area: z.number().nullable().optional(),
  total_area: z.number().nullable().optional(),
  financing_allowed: z.boolean().optional(),
  owner_name: z.string().nullable().optional(),
  assigned_to_hint: z.string().nullable().optional(),
  address: z.record(z.string(), z.unknown()),
  features: z.record(z.string(), z.unknown()),
  images: z.array(z.string()).optional().default([]),
})

const importBatchSchema = z.object({
  items: z.array(importedPropertySchema).min(1, "Envie ao menos um imóvel por lote.").max(50, "Lote muito grande."),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ ok: false, message: "Sem organização ativa para importar imóveis." }, { status: 403 })
  }

  const role = (profile.role as string | null) ?? null
  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ ok: false, message: "Apenas gestores podem importar imóveis." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: "Payload inválido." }, { status: 400 })
  }

  const parsed = importBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message || "Lote inválido.",
      },
      { status: 400 }
    )
  }

  const organizationId = profile.organization_id as string
  const items = parsed.data.items
  const externalIds = items.map((item) => item.external_id)

  const { data: existingRows, error: existingRowsError } = await supabase
    .from("properties")
    .select("external_id, hide_from_site, assigned_to, owner_name")
    .eq("organization_id", organizationId)
    .in("external_id", externalIds)

  if (existingRowsError) {
    return NextResponse.json(
      { ok: false, message: existingRowsError.message || "Não foi possível preparar o lote de importação." },
      { status: 500 }
    )
  }

  const existingMap = new Map<string, { hide_from_site: boolean | null; assigned_to: string | null; owner_name: string | null }>()
  for (const row of existingRows ?? []) {
    if (row.external_id) {
      existingMap.set(row.external_id, {
        hide_from_site: row.hide_from_site,
        assigned_to: row.assigned_to ?? null,
        owner_name: row.owner_name ?? null,
      })
    }
  }

  const assignedHints = Array.from(
    new Set(
      items
        .map((item) => item.assigned_to_hint?.trim())
        .filter((value): value is string => Boolean(value))
    )
  )

  const profileMap = new Map<string, string>()
  if (assignedHints.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .in("full_name", assignedHints)

    if (profilesError) {
      return NextResponse.json(
        { ok: false, message: profilesError.message || "Não foi possível resolver os responsáveis do lote." },
        { status: 500 }
      )
    }

    for (const profile of profiles ?? []) {
      const fullName = profile.full_name?.trim()
      if (fullName && profile.id) {
        profileMap.set(fullName.toLocaleLowerCase("pt-BR"), profile.id)
      }
    }
  }

  const payloads = items.map((item) => {
    const existing = existingMap.get(item.external_id)
    const alreadyPublished = existing?.hide_from_site === false
    const assignedHintKey = item.assigned_to_hint?.trim().toLocaleLowerCase("pt-BR") ?? null
    const resolvedAssignedTo = assignedHintKey ? profileMap.get(assignedHintKey) ?? null : null

    return {
      organization_id: organizationId,
      external_id: item.external_id,
      title: item.title,
      description: item.description ?? "",
      price: item.price ?? 0,
      type: item.type,
      status: item.status,
      transaction_type: item.transaction_type ?? null,
      purpose: item.purpose ?? null,
      built_area: item.built_area ?? null,
      total_area: item.total_area ?? null,
      financing_allowed: Boolean(item.financing_allowed),
      assigned_to: resolvedAssignedTo ?? existing?.assigned_to ?? null,
      owner_name: item.owner_name?.trim() || existing?.owner_name || null,
      address: item.address,
      features: item.features,
      images: item.images ?? [],
      image_paths: deriveStoragePathsForBucket(item.images, "properties"),
      hide_from_site: alreadyPublished ? false : true,
      updated_at: new Date().toISOString(),
    }
  })

  const { error: upsertError } = await supabase
    .from("properties")
    .upsert(payloads, { onConflict: "organization_id,external_id" })

  if (upsertError) {
    const summary: PropertyImportBatchSummary = {
      requestedCount: items.length,
      createdCount: 0,
      updatedCount: 0,
      errorCount: items.length,
    }
    return NextResponse.json(
      {
        ok: false,
        message: upsertError.message || "Não foi possível persistir o lote de importação.",
        summary,
      },
      { status: 500 }
    )
  }

  revalidatePath("/dashboard")
  revalidatePath("/properties")

  const updatedCount = items.filter((item) => existingMap.has(item.external_id)).length
  const createdCount = items.length - updatedCount
  const summary: PropertyImportBatchSummary = {
    requestedCount: items.length,
    createdCount,
    updatedCount,
    errorCount: 0,
  }

  return NextResponse.json({ ok: true, summary })
}
