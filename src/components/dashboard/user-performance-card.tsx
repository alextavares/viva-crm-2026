"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface UserPerformanceCardProps {
    userName: string
    avatarUrl?: string
    role: string
    lastAccess?: string
}

export function UserPerformanceCard({ userName, avatarUrl, role, lastAccess }: UserPerformanceCardProps) {
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()

    const roleName = role === "owner" ? "Gestor" : role === "admin" ? "Administrador" : "Corretor"

    return (
        <Card className="shadow-sm border-primary/10 bg-gradient-to-br from-card to-primary/5">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                            <AvatarImage src={avatarUrl} alt={userName} />
                            <AvatarFallback className="bg-primary/10 text-primary text-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-1">
                            <h3 className="font-semibold text-lg leading-none">{userName}</h3>
                            <div className="flex items-center gap-2 pt-1">
                                <Badge variant="outline" className="text-[10px] font-medium rounded-md px-1.5 border-primary/20 text-primary">
                                    {roleName}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Último acesso: {lastAccess || "Hoje"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground">Visitas Hoje</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">2</span>
                            <span className="text-[10px] text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-md">Agendadas</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground">Atendimento</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-emerald-600">4</span>
                            <span className="text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Em andamento</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
