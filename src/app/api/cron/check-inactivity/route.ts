import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Database } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    if (
        process.env.CRON_SECRET &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = createAdminClient()

    // 15 days ago date
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const cutOffString = fifteenDaysAgo.toISOString()

    try {
        // 1. Fetch all recent interactions
        const { data: recentInteractions, error: err1 } = await supabase
            .from('contact_interactions')
            .select('contact_id')
            .gte('happened_at', cutOffString)

        if (err1) throw err1

        const activeContactIds = new Set(recentInteractions.map(i => i.contact_id))

        // 2. Fetch old, non-closed contacts
        const { data: contacts, error: err2 } = await supabase
            .from('contacts')
            .select('id, name, assigned_to, organization_id')
            .lte('created_at', cutOffString)
            .not('status', 'in', '("won","lost")')

        if (err2) throw err2

        // 3. Filter inactive
        const inactiveContacts = contacts.filter(c => !activeContactIds.has(c.id))

        if (inactiveContacts.length === 0) {
            return NextResponse.json({ success: true, message: 'No inactive contacts found' })
        }

        // 4. Group by broker
        // Provide 1 notification per broker
        const brokerNotifications = new Map<string, { orgId: string, count: number }>()

        inactiveContacts.forEach(contact => {
            if (!contact.assigned_to) return

            const existing = brokerNotifications.get(contact.assigned_to)
            if (existing) {
                existing.count++
            } else {
                brokerNotifications.set(contact.assigned_to, {
                    orgId: contact.organization_id,
                    count: 1
                })
            }
        })

        // 5. Insert notifications
        const notificationPayloads: Database['public']['Tables']['notifications']['Insert'][] = []
        brokerNotifications.forEach((data, brokerId) => {
            notificationPayloads.push({
                user_id: brokerId,
                organization_id: data.orgId,
                title: 'Alerta de Inatividade',
                body: `Você tem ${data.count} lead(s) sem interação há mais de 15 dias. Acesse o Kanban para resgatá-los.`,
                type: 'inactivity',
                link: '/contacts/kanban',
            })
        })

        if (notificationPayloads.length > 0) {
            const { error: err3 } = await supabase
                .from('notifications')
                .insert(notificationPayloads)

            if (err3) throw err3
        }

        return NextResponse.json({
            success: true,
            inactiveCount: inactiveContacts.length,
            notificationsInserted: notificationPayloads.length
        })

    } catch (error: unknown) {
        console.error('Check inactivity error:', error)
        const message = error instanceof Error ? error.message : 'Erro inesperado ao verificar inatividade'
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
