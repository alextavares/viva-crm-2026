'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Notification = {
    id: string
    type: string
    title: string
    body: string | null
    link: string | null
    read_at: string | null
    created_at: string
}

const TYPE_ICONS: Record<string, string> = {
    new_lead: '🧑',
    visit: '📅',
    sla: '⏰',
    proposal: '📄',
    default: '🔔',
}

function relativeTime(value: string) {
    try {
        return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
    } catch {
        return ''
    }
}

export function NotificationsMenu() {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = useCallback(async () => {
        const { data } = await supabase
            .from('notifications')
            .select('id, type, title, body, link, read_at, created_at')
            .order('created_at', { ascending: false })
            .limit(20)
        if (data) {
            setNotifications(data as Notification[])
            setUnreadCount(data.filter((n: any) => !n.read_at).length)
        }
    }, [supabase])

    useEffect(() => {
        fetchNotifications()

        // Realtime subscription
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                () => fetchNotifications()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchNotifications, supabase])

    // Mark all as read when popover opens
    const handleOpen = async (isOpen: boolean) => {
        setOpen(isOpen)
        if (isOpen && unreadCount > 0) {
            await supabase
                .from('notifications')
                .update({ read_at: new Date().toISOString() })
                .is('read_at', null)
            setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
            setUnreadCount(0)
        }
    }

    return (
        <Popover open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm font-semibold">Notificações</span>
                    {unreadCount === 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="h-3 w-3" /> Tudo lido
                        </span>
                    )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            Nenhuma notificação.
                        </div>
                    ) : (
                        notifications.map((n) => {
                            const icon = TYPE_ICONS[n.type] ?? TYPE_ICONS['default']
                            const isUnread = !n.read_at
                            const content = (
                                <div
                                    className={`flex gap-3 border-b px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${isUnread ? 'bg-primary/5' : ''}`}
                                >
                                    <span className="mt-0.5 text-lg leading-none">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {n.title}
                                        </p>
                                        {n.body && (
                                            <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {relativeTime(n.created_at)}
                                        </p>
                                    </div>
                                </div>
                            )
                            return n.link ? (
                                <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                                    {content}
                                </Link>
                            ) : (
                                <div key={n.id}>{content}</div>
                            )
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
