#!/usr/bin/env node
/* eslint-disable no-console */
const { createClient } = require("@supabase/supabase-js")

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    from: null,
    to: null,
    pilotOrgIds: null,
    ticketsOpened: null,
  }
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--from") out.from = args[i + 1] || null
    if (args[i] === "--to") out.to = args[i + 1] || null
    if (args[i] === "--pilot-org-ids") out.pilotOrgIds = (args[i + 1] || "").trim() || null
    if (args[i] === "--tickets-opened") out.ticketsOpened = args[i + 1] || null
  }
  return out
}

async function run() {
  const { from, to, pilotOrgIds, ticketsOpened } = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)

  const [{ data: orgs, error: orgsError }, { data: plans, error: plansError }] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, created_at"),
    supabase.from("broker_seat_plans").select("organization_id"),
  ])
  if (orgsError) throw orgsError
  if (plansError) throw plansError

  const plannedOrgIds = new Set((plans || []).map((p) => p.organization_id))
  const missingPlans = (orgs || [])
    .filter((org) => !plannedOrgIds.has(org.id))
    .map((org) => ({ id: org.id, name: org.name, slug: org.slug }))

  const { data: seatConsistency, error: consistencyError } = await supabase
    .from("broker_seat_plans")
    .select("organization_id, broker_seat_limit")

  if (consistencyError) throw consistencyError

  const inconsistencies = []
  for (const row of seatConsistency || []) {
    const { data: usageRows, error: usageError } = await supabase.rpc("get_broker_seat_usage", {
      p_org_id: row.organization_id,
    })
    if (usageError) continue
    const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows
    if ((usage?.used ?? 0) > (row?.broker_seat_limit ?? 0)) {
      inconsistencies.push({
        organization_id: row.organization_id,
        used: usage.used,
        seat_limit: row.broker_seat_limit,
      })
    }
  }

  const pilotOrgIdList = (pilotOrgIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  const hasPilotFilter = pilotOrgIdList.length > 0

  let pilotMetrics = {
    pilot_orgs_count: hasPilotFilter ? pilotOrgIdList.length : 0,
    upgrades_applied: 0,
    downgrades_scheduled: 0,
    downgrades_applied: 0,
    downgrades_blocked: 0,
    tickets_opened: Number.isFinite(Number(ticketsOpened)) ? Number(ticketsOpened) : 0,
  }

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = to || new Date().toISOString()

  let changesQuery = supabase
    .from("broker_seat_plan_changes")
    .select("action, status, created_at, organization_id")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
  if (hasPilotFilter) changesQuery = changesQuery.in("organization_id", pilotOrgIdList)
  const { data: changes, error: changesError } = await changesQuery

  if (changesError) throw changesError
  for (const c of changes || []) {
    if (c.action === "upgrade" && c.status === "applied") pilotMetrics.upgrades_applied += 1
    if (c.action === "downgrade" && c.status === "scheduled") pilotMetrics.downgrades_scheduled += 1
    if (c.action === "downgrade" && c.status === "applied") pilotMetrics.downgrades_applied += 1
  }

  let blockedQuery = supabase
    .from("team_audit_events")
    .select("action, created_at, organization_id")
    .eq("action", "seat_downgrade_blocked")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
  if (hasPilotFilter) blockedQuery = blockedQuery.in("organization_id", pilotOrgIdList)
  const { data: auditRows, error: auditError } = await blockedQuery
  if (auditError) throw auditError
  pilotMetrics.downgrades_blocked = (auditRows || []).length

  let ticketHintCount = 0
  let ticketHintsQuery = supabase
    .from("team_audit_events")
    .select("id", { count: "exact", head: true })
    .in("level", ["warning", "error"])
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
  if (hasPilotFilter) ticketHintsQuery = ticketHintsQuery.in("organization_id", pilotOrgIdList)
  const { count: ticketHints, error: ticketHintsError } = await ticketHintsQuery
  if (!ticketHintsError) ticketHintCount = ticketHints || 0

  console.log(
    JSON.stringify(
      {
        ok: true,
        window: { from: fromDate, to: toDate },
        scope: hasPilotFilter ? "pilot_orgs" : "global",
        pilot_org_ids: hasPilotFilter ? pilotOrgIdList : [],
        missing_plans_count: (missingPlans || []).length,
        missing_plans: missingPlans || [],
        inconsistent_orgs_count: inconsistencies.length,
        inconsistent_orgs: inconsistencies,
        pilot_metrics: pilotMetrics,
        pilot_ticket_hints: ticketHintCount,
        notes: [
          "missing_plans should be 0 after rollout backfill",
          "inconsistent_orgs should be 0 (used cannot exceed limit)",
          "tickets_opened is a manual operational metric via --tickets-opened",
          "pilot_ticket_hints counts warning/error audit events in the selected window",
        ],
        warnings: [],
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
