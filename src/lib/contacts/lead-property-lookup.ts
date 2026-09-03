import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"
import type { PropertyLookupRecord } from "@/lib/contacts/lead-property-context"

type PropertyLookupMap = Map<string, PropertyLookupRecord>

export async function loadLeadPropertyLookupById(
  supabase: SupabaseClient<Database>,
  propertyIds: string[],
  organizationId?: string | null
): Promise<PropertyLookupMap> {
  const uniquePropertyIds = Array.from(new Set(propertyIds.map((id) => id.trim()).filter(Boolean)))
  const propertyLookupById: PropertyLookupMap = new Map()

  if (uniquePropertyIds.length === 0) {
    return propertyLookupById
  }

  let scopedQuery = supabase
    .from("properties")
    .select("id, title, public_code")
    .in("id", uniquePropertyIds)

  if (organizationId) {
    scopedQuery = scopedQuery.eq("organization_id", organizationId)
  }

  const { data: visibleProperties, error: visiblePropertiesError } = await scopedQuery

  if (visiblePropertiesError) {
    console.error("Error fetching lead property lookup with scoped client:", visiblePropertiesError)
  } else {
    for (const property of visibleProperties || []) {
      propertyLookupById.set(property.id, property)
    }
  }

  const missingPropertyIds = uniquePropertyIds.filter((propertyId) => !propertyLookupById.has(propertyId))
  if (missingPropertyIds.length === 0) {
    return propertyLookupById
  }

  try {
    const admin = createAdminClient()
    let adminQuery = admin
      .from("properties")
      .select("id, title, public_code")
      .in("id", missingPropertyIds)

    if (organizationId) {
      adminQuery = adminQuery.eq("organization_id", organizationId)
    }

    const { data: adminProperties, error: adminPropertiesError } = await adminQuery

    if (adminPropertiesError) {
      console.error("Error fetching lead property lookup with admin client:", adminPropertiesError)
    } else {
      for (const property of adminProperties || []) {
        propertyLookupById.set(property.id, property)
      }
    }
  } catch (error) {
    console.error("Unexpected admin fallback error for lead property lookup:", error)
  }

  return propertyLookupById
}
