import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveCname } from "node:dns/promises"

function normalizeHost(v: string) {
  const host = v.trim().toLowerCase()
  // remove scheme/path if user pasted a URL
  const noScheme = host.replace(/^https?:\/\//, "")
  const noPath = noScheme.split("/")[0]
  const noPort = noPath.split(":")[0]
  return noPort.replace(/\.$/, "")
}

function normalizeCnameTarget(v: string) {
  return v.trim().toLowerCase().replace(/\.$/, "")
}

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()
  if (profileError || !profile?.organization_id) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const role = (profile.role as string | null) ?? null
  const isAdmin = role === "owner" || role === "manager"
  if (!isAdmin) return new NextResponse("Forbidden", { status: 403 })

  const orgId = profile.organization_id as string

  const { data: row, error: rowError } = await supabase
    .from("custom_domains")
    .select("organization_id, domain, status")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (rowError) {
    return NextResponse.json({ ok: false, message: rowError.message }, { status: 500 })
  }
  if (!row?.domain) {
    return NextResponse.json({ ok: false, message: "Nenhum domínio configurado." }, { status: 400 })
  }

  const domain = normalizeHost(String(row.domain))
  if (!domain.startsWith("www.")) {
    return NextResponse.json(
      { ok: false, message: "No MVP, use um domínio começando com www. (ex.: www.seudominio.com.br)." },
      { status: 400 }
    )
  }

  const expected = normalizeCnameTarget(process.env.SITES_CNAME_TARGET || "sites.vivacrm.com.br")

  let resolved: string[] = []
  try {
    resolved = (await resolveCname(domain)).map(normalizeCnameTarget)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao consultar DNS."
    await supabase
      .from("custom_domains")
      .update({
        status: "error",
        last_error: msg,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
    return NextResponse.json({ ok: false, message: msg }, { status: 200 })
  }

  const ok = resolved.some((r) => r === expected)
  if (!ok) {
    const msg = `CNAME não encontrado. Esperado: ${expected}. Encontrado: ${resolved.join(", ") || "(vazio)"}`
    await supabase
      .from("custom_domains")
      .update({
        status: "error",
        last_error: msg,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
    return NextResponse.json({ ok: false, message: msg }, { status: 200 })
  }

  await supabase
    .from("custom_domains")
    .update({
      status: "verified",
      last_error: null,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)

  return NextResponse.json({ ok: true, message: "Domínio verificado com sucesso.", domain, expected })
}

