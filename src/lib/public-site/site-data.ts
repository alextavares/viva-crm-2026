import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { siteGetNews, siteGetProperty, siteGetSettings, siteListLinks, siteListNews } from "@/lib/site"

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

export const getPublicNews = cache(async (slug: string, newsSlug: string) => {
  const supabase = await createClient()
  const { data } = await siteGetNews(supabase, slug, newsSlug)
  return data ?? null
})

export const getPublicNewsList = cache(async (slug: string, limit = 12, offset = 0) => {
  const supabase = await createClient()
  const { data } = await siteListNews(supabase, {
    siteSlug: slug,
    limit,
    offset,
  })
  return data ?? []
})

export const getPublicLinks = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await siteListLinks(supabase, slug)
  return data ?? []
})
