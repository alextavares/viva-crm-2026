'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { markAllNotificationsRead } from '@/app/actions/notifications'
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
    const [markingRead, setMarkingRead] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const fetchNotifications = useCallback(async () => {
        const { data } = await supabase
            .from('notifications')
            .select('id, type, title, body, link, read_at, created_at')
            .order('created_at', { ascending: false })
            .limit(20)
        if (data) {
            const nextNotifications = data as Notification[]
            setNotifications(nextNotifications)
            setUnreadCount(nextNotifications.filter((n) => !n.read_at).length)
        }
    }, [supabase])

    useEffect(() => {
        const bootstrap = async () => {
            await fetchNotifications()
        }
        void bootstrap()

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
            setMarkingRead(true)
            setErrorMsg(null)
            const result = await markAllNotificationsRead()
            if (result.success) {
                const readAt = result.data?.readAt ?? new Date().toISOString()
                setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? readAt })))
                setUnreadCount(0)
            } else {
                setErrorMsg(result.error)
                toast.error(result.error)
            }
            setMarkingRead(false)
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
                    {markingRead ? (
                        <span className="text-xs text-muted-foreground">Marcando como lidas...</span>
                    ) : unreadCount === 0 ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="h-3 w-3" /> Tudo lido
                        </span>
                    ) : null}
                </div>
                {errorMsg ? (
                    <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                        {errorMsg}
                    </div>
                ) : null}
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
                                        <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
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
