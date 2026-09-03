import { NextResponse } from "next/server"

/**
 * Legacy generic portal feed (`GET /api/feeds/[portal]/[token]`).
 *
 * Retired against the canonical contract: the legacy `feed_properties` RPC no
 * longer exists, and the canonical feed boundary is
 * `api.imovelweb_feed(p_slug, p_feed_secret, p_max_rows)` (service_role only),
 * served per organization at `GET /api/public/s/[slug]/imovelweb-xml?token=…`.
 * There is no canonical feed contract for other portals.
 *
 * CANONICAL CONTRACT GAP: zap/olx feed RPCs.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portal: string; token: string }> }
) {
  const { portal } = await params
  return NextResponse.json(
    {
      error: "Gone",
      portal,
      imovelweb_feed_url: "/api/public/s/[slug]/imovelweb-xml?token=<feed-secret>",
    },
    { status: 410 }
  )
}
