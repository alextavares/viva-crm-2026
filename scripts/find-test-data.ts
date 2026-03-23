
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('--- BUSCANDO DADOS PARA TESTE ---')

    const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, slug, name')
        .limit(1)

    if (orgError) {
        console.error('ERRO SUPABASE:', orgError)
        return
    }

    if (!orgs?.length) {
        console.error('Nenhuma organização encontrada.')
        return
    }

    const org = orgs[0]
    console.log(`ORG_NAME: ${org.name}`)
    console.log(`ORG_SLUG: ${org.slug}`)

    const { data: integrations, error: intError } = await supabase
        .from('portal_integrations')
        .select('*')
        .eq('organization_id', org.id)

    if (intError) {
        console.error('ERRO INTEGRAÇÕES:', intError)
        return
    }

    if (!integrations?.length) {
        const token = 'test-token-123'
        await supabase.from('portal_integrations').insert({
            organization_id: org.id,
            portal: 'zap_vivareal',
            status: 'active',
            config: { feed_token: token }
        })
        console.log(`TOKEN_GERADO: ${token}`)
    } else {
        integrations.forEach(i => {
            console.log(`PORTAL: ${i.portal}, STATUS: ${i.status}, TOKEN: ${i.config?.feed_token}`)
        })
    }
}

run()
