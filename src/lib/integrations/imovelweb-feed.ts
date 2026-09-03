import { CRMProperty } from "@/lib/integrations/zap-mapper"
import { resolveMediaPathUrl } from "@/lib/media"

export type ImovelwebFeedRow = {
  external_id: string | null
  public_code: string
  title: string | null
  description: string | null
  type: string | null
  transaction_type: string | null
  price: number | null
  built_area: number | null
  total_area: number | null
  address: { city?: string | null; neighborhood?: string | null } | null
  image_paths: string[] | null
  publication_status: string | null
}

/**
 * Map a bounded `api.imovelweb_feed` row onto the OpenNavent mapper input.
 * The canonical projection carries no lat/lng, street-level address,
 * bedrooms, or structured features, so those mapper inputs stay empty by
 * contract; images resolve from `image_paths` via public storage URLs.
 */
export function toFeedProperty(row: ImovelwebFeedRow, index: number): CRMProperty {
  const images = (Array.isArray(row.image_paths) ? row.image_paths : [])
    .map((path) => resolveMediaPathUrl("properties", path))
    .filter((url): url is string => typeof url === "string" && url.length > 0)

  return {
    id: row.public_code || `feed-${index}`,
    external_id: row.external_id,
    public_code: row.public_code,
    title: row.title ?? "",
    description: row.description,
    price: row.price,
    type: row.type,
    transaction_type: row.transaction_type,
    status: "available",
    features: null,
    address: {
      city: row.address?.city ?? null,
      neighborhood: row.address?.neighborhood ?? null,
    },
    images,
    image_paths: row.image_paths ?? [],
  } as CRMProperty
}
