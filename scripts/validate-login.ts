import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function main() {
    const email = 'e2e.imobicrm.2026@gmail.com'
    const password = 'TempE2E!2026'

    console.log(`Attempting login for: ${email}...`)

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        console.error('Login Error:', error)
        // Detailed error info might be in error.status or error.message
        console.log('Error Status:', error.status)
        process.exit(1)
    }

    console.log('Login Successful!')
    console.log('Session User ID:', data.user.id)
    console.log('Access Token present:', !!data.session.access_token)
}

main()
