import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const siteSlug = process.env.TEST_SITE_SLUG || process.env.NEXT_PUBLIC_TEST_SITE_SLUG

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.")
}

if (!siteSlug) {
  throw new Error("Missing TEST_SITE_SLUG (or NEXT_PUBLIC_TEST_SITE_SLUG) in environment.")
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log(`Using siteSlug: ${siteSlug}`)

    const ts = Date.now()
    for (let i = 1; i <= 4; i++) {
        const res = await supabase.rpc("site_create_lead", {
            p_site_slug: siteSlug,
            p_property_id: null,
            p_name: `Lead RoundRobin ${ts} ${i}`,
            p_phone: `119${ts.toString().slice(-8)}${i}`,
            p_message: `Test round robin ${i}`,
            p_source_domain: "localhost:3015"
        })
        console.log(`Lead ${i} Created:`, res.data, res.error)
    }

    // wait a bit for triggers or async jobs to run if round robin isn't inline
    await new Promise(r => setTimeout(r, 2000))

    const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, assigned_to, profiles!contacts_assigned_to_fkey(name)")
        .like("name", `Lead RoundRobin ${ts} %`)
        .order("created_at", { ascending: false })
        .limit(4)

    console.log("Assigned contacts:", JSON.stringify(contacts, null, 2))
}

run().catch(console.error)
