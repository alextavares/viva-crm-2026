import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateImovelwebXml, type ImovelwebFeedConfig } from "@/lib/integrations/imovelweb-mapper"
import { toFeedProperty, type ImovelwebFeedRow } from "@/lib/integrations/imovelweb-feed"

export const dynamic = "force-dynamic"

const FEED_MAX_ROWS = 5000

function nonSecretFeedConfig(config: unknown): {
  integrationId: string | null
  mapperConfig: ImovelwebFeedConfig
} {
  const raw = (config ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  return {
    integrationId: null,
    mapperConfig: {
      codigoImobiliaria: str(raw.codigo_imobiliaria),
      emailUsuario: str(raw.email_usuario),
      emailContato: str(raw.email_contato),
      nomeContato: str(raw.nome_contato),
      telefoneContato: str(raw.telefone_contato),
      tipoPublicacao: str(raw.tipo_publicacao_default) || "SIMPLE",
      mostrarMapa: typeof raw.mostrar_mapa === "string" || typeof raw.mostrar_mapa === "boolean" ? raw.mostrar_mapa : undefined,
      defaultLocalidadeId: str(raw.default_localidade_id),
      localidadeMappingsRaw: str(raw.localidade_mappings_raw),
    },
  }
}

/**
 * Canonical Imovelweb OpenNavent feed.
 * URL: GET /api/public/s/[slug]/imovelweb-xml?token=<feed-secret>
 *
 * Boundary: listings come from `api.imovelweb_feed`, which verifies the
 * presented feed secret server-side against `private.integration_credentials`
 * (provider `imovelweb`, purpose `feed_auth`) and enforces the bounded
 * projection plus `publish_imovelweb` / availability predicates. This route
 * never compares secrets itself and never stores them in
 * `portal_integrations.config` (forbidden by the canonical contract); only
 * non-secret display config is read from there.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Server misconfiguration: missing environment variables.", { status: 500 })
    }

    const { slug } = await params
    const token = request.nextUrl.searchParams.get("token")

    if (!slug || !token) {
      return new Response("Missing token parameter.", { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase.rpc("imovelweb_feed", {
      p_slug: slug,
      p_feed_secret: token,
      p_max_rows: FEED_MAX_ROWS,
    })

    if (error) {
      const msg = error.message ?? ""
      // Wrong secret / unknown org / inactive credential all surface as empty-or-error;
      // never distinguish them for unauthenticated callers.
      if (msg.includes("invalid") || msg.includes("credential")) {
        return new Response("Invalid token.", { status: 403 })
      }
      return new Response("Internal error fetching properties.", { status: 500 })
    }

    const rows = (Array.isArray(data) ? data : []) as ImovelwebFeedRow[]

    const { data: org } = await supabase.from("organizations").select("id, name, slug").eq("slug", slug).single()
    const { data: integration } = await supabase
      .from("portal_integrations")
      .select("config")
      .eq("organization_id", org?.id ?? "")
      .eq("portal", "imovelweb")
      .maybeSingle()

    const { mapperConfig } = nonSecretFeedConfig(integration?.config)
    if (!mapperConfig.emailContato && org?.slug) {
      mapperConfig.emailContato = `contato@${org.slug}.com.br`
    }
    if (!mapperConfig.nomeContato && org?.name) {
      mapperConfig.nomeContato = org.name
    }

    if (org?.id) {
      supabase
        .from("portal_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("organization_id", org.id)
        .eq("portal", "imovelweb")
        .then(({ error: syncError }) => {
          if (syncError) console.error("[imovelweb-xml] Failed to update last_sync_at:", syncError.message)
        })
    }

    const xmlString = generateImovelwebXml(rows.map((row, i) => toFeedProperty(row, i)), mapperConfig)

    return new Response(xmlString, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[imovelweb-xml] Unhandled exception:", msg)
    return new Response(`Internal server error: ${msg}`, { status: 500 })
  }
}
