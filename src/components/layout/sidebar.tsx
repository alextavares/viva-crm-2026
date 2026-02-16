"use client"

import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Building2,
    Users,
    Calendar,
    Plug,
    Settings,
    LogOut,
    Building
} from 'lucide-react'

const sidebarItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'Imóveis',
        href: '/properties',
        icon: Building2,
    },
    {
        title: 'Contatos',
        href: '/contacts',
        icon: Users,
    },
    {
        title: 'Agendamentos',
        href: '/appointments',
        icon: Calendar,
    },
    {
        title: 'Integrações',
        href: '/integrations',
        icon: Plug,
    },
    {
        title: 'Configurações',
        href: '/settings',
        icon: Settings,
    },
]

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname()
    const { signOut } = useAuth()

    return (
        <div className={cn("flex h-full flex-col border-r bg-card", className)}>
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Building className="h-6 w-6 text-primary" />
                    <span className="">ImobCRM 49</span>
                </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                    pathname === item.href
                                        ? "bg-muted text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        )
                    })}
                </nav>
            </div>
            <div className="mt-auto p-4">
                <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary cursor-pointer hover:bg-muted"
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </button>
            </div>
        </div>
    )
}
