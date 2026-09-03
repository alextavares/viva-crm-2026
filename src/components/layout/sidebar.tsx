"use client"

import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Building2,
    Users,
    Bot,
    Globe,
    Calendar,
    Plug,
    Settings,
    LogOut,
    Building,
    Headset
} from 'lucide-react'
import type { UserRole } from '@/lib/types'

type SidebarItem = {
    title: string
    href: string
    icon: typeof LayoutDashboard
    adminOnly?: boolean
    section: string
    emphasis?: 'primary' | 'secondary'
}

export function getSidebarItems(role: UserRole | null) {
    const isBroker = role === "broker"

    return [
        {
            title: 'Atendimentos',
            href: '/attendances',
            icon: Headset,
            section: 'Rotina diária',
            emphasis: 'primary',
        },
        {
            title: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboard,
            section: 'Rotina diária',
            emphasis: 'secondary',
        },
        {
            title: 'Agenda',
            href: '/appointments',
            icon: Calendar,
            section: 'Rotina diária',
            emphasis: 'secondary',
        },
        {
            title: 'Base de contatos',
            href: '/contacts',
            icon: Users,
            section: 'CRM',
            emphasis: 'secondary',
        },
        {
            title: isBroker ? 'Meus leads do site' : 'Leads do site',
            href: '/contacts/site',
            icon: Globe,
            section: 'CRM',
            emphasis: 'secondary',
        },
        {
            title: 'Imóveis',
            href: '/properties',
            icon: Building2,
            section: 'Carteira',
            emphasis: 'secondary',
        },
        {
            title: 'Leads IA',
            href: '/ai-leads',
            icon: Bot,
            section: 'Apoio',
            emphasis: 'secondary',
        },
        {
            title: 'Integrações',
            href: '/integrations',
            icon: Plug,
            adminOnly: true,
            section: 'Administração',
            emphasis: 'secondary',
        },
        {
            title: 'Configurações',
            href: '/settings',
            icon: Settings,
            adminOnly: true,
            section: 'Administração',
            emphasis: 'secondary',
        },
    ] satisfies SidebarItem[]
}

export function getVisibleSidebarItems(role: UserRole | null) {
    const canManageOperation = role === "owner" || role === "manager"
    return getSidebarItems(role).filter((item) => !item.adminOnly || canManageOperation)
}

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname()
    const { signOut, role } = useAuth()
    const visibleItems = getVisibleSidebarItems(role)

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
                    {visibleItems.map((item, index) => {
                        const Icon = item.icon
                        const isActive =
                            item.href === "/contacts"
                                ? pathname === "/contacts" ||
                                  (pathname.startsWith("/contacts/") && !pathname.startsWith("/contacts/site"))
                                : pathname === item.href || pathname.startsWith(`${item.href}/`)
                        const showSectionLabel = index === 0 || visibleItems[index - 1].section !== item.section
                        return (
                            <Fragment key={item.href}>
                                {showSectionLabel ? (
                                    <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80 first:pt-1">
                                        {item.section}
                                    </div>
                                ) : null}
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                        item.emphasis === "primary" && !isActive ? "font-semibold text-foreground" : "",
                                        isActive
                                            ? "bg-muted text-primary"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.title}
                                </Link>
                            </Fragment>
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
