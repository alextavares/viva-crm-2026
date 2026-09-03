import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Zap/VivaReal lead webhook — RETIRED (410).
 *
 * Canonical parking: the frozen contract provides no Zap ingest/verification
 * RPC, so this endpoint performs no DB/secret lookup and logs no payload
 * data (no PII). Re-enable only when a Zap webhook verifier contract is
 * separately authorized. ImovelWeb leads remain served at
 * `/api/public/webhooks/[slug]/imovelweb` via `api.imovelweb_ingest`.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Gone",
      portal: "zap_vivareal",
      message: "Zap/VivaReal webhook is retired pending a canonical verifier contract.",
    },
    { status: 410 }
  )
}
