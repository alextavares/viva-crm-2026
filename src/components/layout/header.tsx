'use client'

import { CircleUser, Menu, Search } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { NotificationsMenu } from './notifications-menu'
import { Sidebar } from './sidebar'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'

export function Header() {
    const { signOut, role } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const canManageOperation = role === "owner" || role === "manager"
    const isBroker = role === "broker"
    const [searchValue, setSearchValue] = useState("")

    function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const query = searchValue.trim()
        if (!query) return

        const destination = isBroker
            ? `/attendances?q=${encodeURIComponent(query)}`
            : `/contacts?q=${encodeURIComponent(query)}`

        if (pathname === destination) {
            router.refresh()
            return
        }

        router.push(destination)
    }

    return (
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 w-[240px]">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Navegação principal</SheetTitle>
                    </SheetHeader>
                    <Sidebar className="border-r-0" />
                </SheetContent>
            </Sheet>
            <div className="w-full flex-1">
                <form onSubmit={handleSearchSubmit}>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                            placeholder={isBroker ? "Buscar atendimentos" : "Buscar contatos e leads"}
                            className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                        />
                    </div>
                </form>
            </div>
            <NotificationsMenu />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="rounded-full">
                        <CircleUser className="h-5 w-5" />
                        <span className="sr-only">Toggle user menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {canManageOperation ? (
                        <DropdownMenuItem asChild>
                            <Link href="/settings">Configurações</Link>
                        </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem>Suporte</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={(e) => {
                            e.preventDefault()
                            void signOut()
                        }}
                    >
                        Sair
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    )
}
