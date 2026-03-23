import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testRpcAnon() {
    const slug = "demo-vivacrm"
    console.log(`Calling site_get_settings with anon key for slug: ${slug}...`)

    const { data, error } = await supabase.rpc("site_get_settings", { p_site_slug: slug })

    if (error) {
        console.error("RPC Error (anon):", error)
    } else {
        console.log("RPC Success (anon):", JSON.stringify(data, null, 2))
    }
}

testRpcAnon()
