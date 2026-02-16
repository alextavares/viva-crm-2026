import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase URL or Anon Key')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
    const email = 'e2e.imobicrm.2026@gmail.com'
    const password = 'TempE2E!2026'

    console.log(`Creating user: ${email}...`)

    // 1. Sign Up (Public API)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'E2E User',
                organization_name: 'E2E Org'
            }
        }
    })

    if (signUpError) {
        console.error('SignUp Error:', signUpError)
        process.exit(1)
    }

    const userId = signUpData.user?.id
    console.log(`User created with ID: ${userId}`)

    if (!userId) {
        console.error('User ID not returned')
        process.exit(1)
    }

    // 2. WAIT for confirmation (Simulated via SQL externally, but script will pause)
    // Actually, I can't confirm via public API without email link.
    // The script will exit, then I run SQL, then I run script part 2 (login).
    // Or I can just output "User Created, please confirm via SQL" and then have a second script or part.
    // But wait, I am the agent. I can pause the script? No.
    // I will make this script just do SignUp.
    // I will then run SQL to confirm.
    // Then I will run another script to Login.

    // Actually, I can put a delay loop checking for confirmation?
    // No, `signIn` will fail if not confirmed? Depends on config.
    // Usually "Confirm Email" is required.
}

main()
