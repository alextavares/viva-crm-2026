export const dynamic = "force-dynamic"

/**
 * Zap/VivaReal XML feed — RETIRED (410).
 *
 * Canonical parking: the frozen contract provides no Zap feed verification
 * (no `feed_properties` RPC, no Zap credential verifier), so this endpoint
 * performs no DB/secret lookup and logs no payload data. Re-enable only when
 * a Zap feed verifier contract is separately authorized. ImovelWeb remains
 * served at `/api/public/s/[slug]/imovelweb-xml`.
 */
export async function GET() {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<feed retired="true" portal="zap_vivareal">\n  <message>Zap/VivaReal feed is retired pending a canonical verifier contract. ImovelWeb remains available.</message>\n</feed>\n`,
    {
      status: 410,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  )
}
