"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import { isAdmin, type ActionResult } from "@/lib/types"

type SiteNewsRow = Database["public"]["Tables"]["site_news"]["Row"]
type SiteLinkRow = Database["public"]["Tables"]["site_links"]["Row"]

const siteNewsSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Título da notícia é obrigatório."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug inválido.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido. Use apenas letras minúsculas, números e hífens."),
  excerpt: z.string().trim().nullable().optional(),
  content: z.string().trim().min(50, "Conteúdo da notícia deve ter pelo menos 50 caracteres."),
})

const siteRecordIdSchema = z.object({
  id: z.string().uuid("Registro inválido."),
})

const siteLinkSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Título do link é obrigatório."),
  url: z.string().trim().url("URL inválida. Use http:// ou https://"),
  description: z.string().trim().nullable().optional(),
  sortOrder: z.coerce.number().int("Ordem inválida."),
})

async function getSiteContentContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: "Não autenticado." } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { supabase, error: "Sem permissão." } as const
  }

  if (!isAdmin(profile.role)) {
    return { supabase, error: "Apenas gestores podem alterar o conteúdo do site." } as const
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", profile.organization_id)
    .single()

  return { supabase, profile, organization } as const
}

function revalidateSiteContentPaths(slug?: string | null) {
  revalidatePath("/settings/site")
  revalidatePath("/settings")
  if (slug) {
    revalidatePath(`/s/${slug}`)
  }
}

export async function saveSiteNews(input: z.infer<typeof siteNewsSchema>): Promise<ActionResult<{ news: SiteNewsRow }>> {
  try {
    const parsed = siteNewsSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Dados inválidos na notícia." }
    }

    const auth = await getSiteContentContext()
    if ("error" in auth) {
      return { success: false, error: auth.error ?? "Sem permissão." }
    }

    const payload = {
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt?.trim() || null,
      content: parsed.data.content,
      updated_at: new Date().toISOString(),
    }

    const slugConflictQuery = auth.supabase
      .from("site_news")
      .select("id")
      .eq("organization_id", auth.profile.organization_id)
      .eq("slug", parsed.data.slug)

    const { data: slugConflict } = parsed.data.id
      ? await slugConflictQuery.neq("id", parsed.data.id).maybeSingle()
      : await slugConflictQuery.maybeSingle()

    if (slugConflict?.id) {
      return { success: false, error: "Já existe uma notícia com esse slug nesta organização." }
    }

    if (parsed.data.id) {
      const { data, error } = await auth.supabase
        .from("site_news")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("organization_id", auth.profile.organization_id)
        .select("*")
        .single()

      if (error) {
        return { success: false, error: error.message || "Erro ao atualizar notícia." }
      }

      revalidateSiteContentPaths(auth.organization?.slug ?? null)
      return { success: true, data: { news: data } }
    }

    const { data, error } = await auth.supabase
      .from("site_news")
      .insert({
        organization_id: auth.profile.organization_id,
        title: payload.title,
        slug: payload.slug,
        excerpt: payload.excerpt,
        content: payload.content,
        is_published: false,
        updated_at: payload.updated_at,
      })
      .select("*")
      .single()

    if (error) {
      return { success: false, error: error.message || "Erro ao criar notícia." }
    }

    revalidateSiteContentPaths(auth.organization?.slug ?? null)
    return { success: true, data: { news: data } }
  } catch (error) {
    console.error("Error saving site news:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao salvar notícia.",
    }
  }
}

export async function toggleSiteNewsPublished(input: { id: string }): Promise<ActionResult<{ news: SiteNewsRow }>> {
  try {
    const parsed = siteRecordIdSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Notícia inválida." }
    }

    const auth = await getSiteContentContext()
    if ("error" in auth) {
      return { success: false, error: auth.error ?? "Sem permissão." }
    }

    const { data: current, error: currentError } = await auth.supabase
      .from("site_news")
      .select("*")
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.profile.organization_id)
      .single()

    if (currentError || !current) {
      return { success: false, error: currentError?.message || "Notícia não encontrada." }
    }

    const nextPublished = !current.is_published
    const { data, error } = await auth.supabase
      .from("site_news")
      .update({
        is_published: nextPublished,
        published_at: nextPublished ? current.published_at ?? new Date().toISOString() : current.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.profile.organization_id)
      .select("*")
      .single()

    if (error) {
      return { success: false, error: error.message || "Erro ao alterar publicação da notícia." }
    }

    revalidateSiteContentPaths(auth.organization?.slug ?? null)
    return { success: true, data: { news: data } }
  } catch (error) {
    console.error("Error toggling site news:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao alterar publicação da notícia.",
    }
  }
}

export async function deleteSiteNews(input: { id: string }): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const parsed = siteRecordIdSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Notícia inválida." }
    }

    const auth = await getSiteContentContext()
    if ("error" in auth) {
      return { success: false, error: auth.error ?? "Sem permissão." }
    }

    const { error } = await auth.supabase
      .from("site_news")
      .delete()
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.profile.organization_id)

    if (error) {
      return { success: false, error: error.message || "Erro ao excluir notícia." }
    }

    revalidateSiteContentPaths(auth.organization?.slug ?? null)
    return { success: true, data: { deletedId: parsed.data.id } }
  } catch (error) {
    console.error("Error deleting site news:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao excluir notícia.",
    }
  }
}

export async function saveSiteLink(input: z.infer<typeof siteLinkSchema>): Promise<ActionResult<{ link: SiteLinkRow }>> {
  try {
    const parsed = siteLinkSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Dados inválidos no link." }
    }

    const auth = await getSiteContentContext()
    if ("error" in auth) {
      return { success: false, error: auth.error ?? "Sem permissão." }
    }

    const payload = {
      title: parsed.data.title,
      url: parsed.data.url,
      description: parsed.data.description?.trim() || null,
      sort_order: parsed.data.sortOrder,
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.id) {
      const { data, error } = await auth.supabase
        .from("site_links")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("organization_id", auth.profile.organization_id)
        .select("*")
        .single()

      if (error) {
        return { success: false, error: error.message || "Erro ao atualizar link." }
      }

      revalidateSiteContentPaths(auth.organization?.slug ?? null)
      return { success: true, data: { link: data } }
    }

    const { data, error } = await auth.supabase
      .from("site_links")
      .insert({
        organization_id: auth.profile.organization_id,
        title: payload.title,
        url: payload.url,
        description: payload.description,
        sort_order: payload.sort_order,
        is_published: false,
        updated_at: payload.updated_at,
      })
      .select("*")
      .single()

    if (error) {
      return { success: false, error: error.message || "Erro ao criar link." }
    }

    revalidateSiteContentPaths(auth.organization?.slug ?? null)
    return { success: true, data: { link: data } }
  } catch (error) {
    console.error("Error saving site link:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao salvar link.",
    }
  }
}

export async function toggleSiteLinkPublished(input: { id: string }): Promise<ActionResult<{ link: SiteLinkRow }>> {
  try {
    const parsed = siteRecordIdSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Link inválido." }
    }

    const auth = await getSiteContentContext()
    if ("error" in auth) {
      return { success: false, error: auth.error ?? "Sem permissão." }
    }

    const { data: current, error: currentError } = await auth.supabase
      .from("site_links")
      .select("*")
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.profile.organization_id)
      .single()

    if (currentError || !current) {
      return { success: false, error: currentError?.message || "Link não encontrado." }
    }

    const { data, error } = await auth.supabase
      .from("site_links")
      .update({
        is_published: !current.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.profile.organization_id)
      .select("*")
      .single()

    if (error) {
      return { success: false, error: error.message || "Erro ao alterar publicação do link." }
    }

    revalidateSiteContentPaths(auth.organization?.slug ?? null)
    return { success: true, data: { link: data } }
  } catch (error) {
    console.error("Error toggling site link:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao alterar publicação do link.",
    }
  }
}

export async function deleteSiteLink(input: { id: string }): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const parsed = siteRecordIdSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Link inválido." }
    }

    const auth = await getSiteContentContext()
    if ("error" in auth) {
      return { success: false, error: auth.error ?? "Sem permissão." }
    }

    const { error } = await auth.supabase
      .from("site_links")
      .delete()
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.profile.organization_id)

    if (error) {
      return { success: false, error: error.message || "Erro ao excluir link." }
    }

    revalidateSiteContentPaths(auth.organization?.slug ?? null)
    return { success: true, data: { deletedId: parsed.data.id } }
  } catch (error) {
    console.error("Error deleting site link:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao excluir link.",
    }
  }
}
