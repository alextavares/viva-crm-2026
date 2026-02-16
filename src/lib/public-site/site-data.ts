import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { siteGetProperty, siteGetSettings } from "@/lib/site"

export const getPublicSite = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await siteGetSettings(supabase, slug)
  return data ?? null
})

export const getPublicProperty = cache(async (slug: string, propertyId: string) => {
  const supabase = await createClient()
  const { data } = await siteGetProperty(supabase, slug, propertyId)
  return data ?? null
})

