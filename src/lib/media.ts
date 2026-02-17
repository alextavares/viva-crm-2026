import type { SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_PUBLIC_MARKER = "/storage/v1/object/public/"

function stripTrailingSlash(v: string) {
  return v.replace(/\/+$/, "")
}

function stripLeadingSlash(v: string) {
  return v.replace(/^\/+/, "")
}

function sanitizeSegment(v: string) {
  return v.replace(/[^a-zA-Z0-9_-]/g, "").trim()
}

function normalizeExtension(v?: string | null) {
  const raw = (v || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
  return raw.length > 0 ? raw.slice(0, 8) : "jpg"
}

function normalizeStoragePath(v: string) {
  return stripLeadingSlash(v.trim()).split(/[?#]/, 1)[0] || ""
}

export function extractSupabasePublicObject(url: string): { bucket: string; path: string } | null {
  const input = url.trim()
  if (!input) return null

  let source = input
  try {
    source = new URL(input).pathname
  } catch {
    // Keep relative/raw URL as-is.
  }

  const markerIndex = source.indexOf(SUPABASE_PUBLIC_MARKER)
  if (markerIndex < 0) return null

  const tail = source.slice(markerIndex + SUPABASE_PUBLIC_MARKER.length).replace(/^\/+/, "")
  const clean = tail.split(/[?#]/, 1)[0] || ""
  const [bucket, ...parts] = clean.split("/")
  if (!bucket || parts.length === 0) return null

  const path = parts.join("/")
  if (!path) return null

  return { bucket, path }
}

export function buildSupabasePublicUrl(bucket: string, path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cleanBucket = bucket.trim()
  const cleanPath = normalizeStoragePath(path)
  if (!base || !cleanBucket || !cleanPath) return null
  return `${stripTrailingSlash(base)}/storage/v1/object/public/${cleanBucket}/${cleanPath}`
}

export function extractStoragePathForBucket(
  raw: string | null | undefined,
  bucket: string
): string | null {
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return null

  const extracted = extractSupabasePublicObject(value)
  if (extracted) {
    if (extracted.bucket !== bucket) return null
    return normalizeStoragePath(extracted.path) || null
  }

  if (value.includes("://")) return null
  return normalizeStoragePath(value) || null
}

export function deriveStoragePathsForBucket(
  urls: Array<string | null | undefined> | null | undefined,
  bucket: string
): string[] {
  if (!Array.isArray(urls) || urls.length === 0) return []
  const out: string[] = []
  for (const url of urls) {
    const path = extractStoragePathForBucket(url, bucket)
    if (path) out.push(path)
  }
  return out
}

export function resolveMediaUrl(rawUrl: string | null | undefined): string | null {
  const url = typeof rawUrl === "string" ? rawUrl.trim() : ""
  if (!url) return null

  const obj = extractSupabasePublicObject(url)
  if (!obj) return url

  const bucketBaseMap: Record<string, string | undefined> = {
    properties: process.env.NEXT_PUBLIC_MEDIA_PROPERTIES_BASE_URL,
    "site-assets": process.env.NEXT_PUBLIC_MEDIA_SITE_ASSETS_BASE_URL,
  }

  const bucketBase = bucketBaseMap[obj.bucket]
  if (bucketBase) {
    return `${stripTrailingSlash(bucketBase)}/${obj.path}`
  }

  const genericOrigin = process.env.NEXT_PUBLIC_MEDIA_CDN_ORIGIN
  if (genericOrigin) {
    return `${stripTrailingSlash(genericOrigin)}/${obj.bucket}/${obj.path}`
  }

  return url
}

export function resolveMediaPathUrl(bucket: string, rawPath: string | null | undefined): string | null {
  const path = typeof rawPath === "string" ? rawPath.trim() : ""
  if (!path) return null
  const publicUrl = buildSupabasePublicUrl(bucket, path)
  if (!publicUrl) return null
  return resolveMediaUrl(publicUrl) ?? publicUrl
}

export function createMediaUploadPath(args: {
  organizationId: string
  scope: "properties" | "site"
  extension?: string | null
  kind?: string | null
}) {
  const org = sanitizeSegment(args.organizationId) || "unknown"
  const scope = sanitizeSegment(args.scope) || "site"
  const ext = normalizeExtension(args.extension)
  const kind = sanitizeSegment(args.kind || "")
  const prefix = kind ? `${kind}-` : ""
  return `org/${org}/${scope}/${prefix}${crypto.randomUUID()}.${ext}`
}

export async function uploadPublicMedia(args: {
  supabase: SupabaseClient
  bucket: string
  path: string
  file: File
  upsert?: boolean
  cacheControl?: string
}) {
  const { supabase, bucket, path, file } = args

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: args.upsert ?? true,
    cacheControl: args.cacheControl ?? "3600",
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error("Não foi possível gerar URL pública da mídia.")

  return {
    path,
    publicUrl: data.publicUrl,
    resolvedUrl: resolveMediaUrl(data.publicUrl) ?? data.publicUrl,
  }
}
