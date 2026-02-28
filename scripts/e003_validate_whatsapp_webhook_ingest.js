#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require("crypto")
const { createClient } = require("@supabase/supabase-js")

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    orgId: null,
    source: "portal_zap",
  }

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--org-id") out.orgId = args[i + 1] || null
    if (args[i] === "--source") out.source = args[i + 1] || out.source
  }

  return out
}

function randomToken() {
  return crypto.randomBytes(16).toString("hex")
}

async function resolveOrganizationId(supabase, orgIdArg) {
  if (orgIdArg) return orgIdArg

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.id) throw new Error("No organization found to run webhook validation")
  return data.id
}

async function run() {
  const { orgId: orgIdArg, source } = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)
  const orgId = await resolveOrganizationId(supabase, orgIdArg)
  const token = randomToken()

  const { error: endpointError } = await supabase.from("webhook_endpoints").insert({
    organization_id: orgId,
    token,
    source,
    is_active: true,
  })
  if (endpointError) throw endpointError

  const runTag = `webhook-validation-${Date.now()}`
  const candidates = [
    {
      provider: "meta",
      external_id: `${runTag}-meta`,
      name: "Lead Meta Inbound",
      phone: "+55 (11) 99988-0001",
      message: "Olá! Tenho interesse no imóvel anunciado.",
    },
    {
      provider: "twilio",
      external_id: `${runTag}-twilio`,
      name: "Lead Twilio Inbound",
      phone: "whatsapp:+55 11 99988-0002",
      message: "Consegue agendar visita para amanhã?",
    },
  ]

  const ingested = []
  for (const candidate of candidates) {
    const { data, error } = await supabase.rpc("webhook_ingest_lead", {
      p_token: token,
      p_source: null,
      p_external_id: candidate.external_id,
      p_name: candidate.name,
      p_phone: candidate.phone,
      p_email: null,
      p_message: candidate.message,
      p_property_id: null,
    })
    if (error) throw error
    if (data?.contact_id) {
      ingested.push({
        provider: candidate.provider,
        contact_id: data.contact_id,
        external_id: candidate.external_id,
      })
    }
  }

  const contactIds = ingested.map((x) => x.contact_id)
  let eventsCount = 0
  let messagesCount = 0
  if (contactIds.length > 0) {
    const [{ count: events }, { count: messages }] = await Promise.all([
      supabase
        .from("contact_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("source", source)
        .in("contact_id", contactIds)
        .eq("type", "lead_received"),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("direction", "in")
        .in("contact_id", contactIds),
    ])
    eventsCount = events || 0
    messagesCount = messages || 0
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        organization_id: orgId,
        source,
        token,
        ingested_count: ingested.length,
        ingested,
        lead_events_found: eventsCount,
        inbound_messages_found: messagesCount,
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message || String(error) }, null, 2))
  process.exit(1)
})

