"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    createManualFollowup,
    resolveManualFollowup,
} from "@/app/actions/followups"
import { parseManualFollowupDescription } from "@/lib/followups/manual-followup"

export interface ManualFollowupRow {
    id: string
    due_at: string
    status: string
    source: string | null
    step: number
}

interface ManualFollowupPanelProps {
    contactId: string
    canManage: boolean
    now: number
    followups: ManualFollowupRow[]
}

const STATUS_LABEL: Record<string, string> = {
    pending: "Pendente",
    processing: "Em andamento",
    completed: "Concluído",
    cancelled: "Cancelado",
}

function toLocalInputValue(date: Date) {
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const DEFAULT_DUE_AT = toLocalInputValue(new Date(new Date().getTime() + 24 * 60 * 60 * 1000))

export function ManualFollowupPanel({ contactId, canManage, now, followups }: ManualFollowupPanelProps) {
    const router = useRouter()
    const [dueAt, setDueAt] = useState(DEFAULT_DUE_AT)
    const [description, setDescription] = useState("")
    const [isPending, startTransition] = useTransition()

    const groups = useMemo(() => {
        const open = followups.filter((row) => row.status === "pending" || row.status === "processing")
        const done = followups.filter((row) => row.status !== "pending" && row.status !== "processing")
        return {
            overdue: open.filter((row) => new Date(row.due_at).getTime() < now),
            upcoming: open.filter((row) => new Date(row.due_at).getTime() >= now),
            done,
        }
    }, [followups, now])

    function handleCreate(event: React.FormEvent) {
        event.preventDefault()
        startTransition(async () => {
            const result = await createManualFollowup({ contactId, dueAt, description })
            if (!result.success) {
                toast.error(result.error)
                return
            }
            toast.success("Retorno agendado.")
            setDescription("")
            router.refresh()
        })
    }

    function handleResolve(followupId: string, resolution: "completed" | "cancelled") {
        startTransition(async () => {
            const result = await resolveManualFollowup({ followupId, resolution })
            if (!result.success) {
                toast.error(result.error)
                return
            }
            toast.success(resolution === "completed" ? "Retorno concluído." : "Retorno cancelado.")
            router.refresh()
        })
    }

    function renderRow(row: ManualFollowupRow) {
        const text = parseManualFollowupDescription(row.source) ?? "Retorno manual"
        const isOpen = row.status === "pending" || row.status === "processing"
        return (
            <div key={row.id} className="rounded-md border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{text}</div>
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                        {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                    Retorno: {new Date(row.due_at).toLocaleString("pt-BR")}
                </div>
                {isOpen && canManage ? (
                    <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleResolve(row.id, "completed")}>
                            Concluir
                        </Button>
                        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleResolve(row.id, "cancelled")}>
                            Cancelar
                        </Button>
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Próximas ações</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Retornos manuais deste contato: vencidos, próximos e concluídos.
            </p>

            {canManage ? (
                <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="grid min-w-[220px] flex-1 gap-1.5">
                        <label htmlFor="manual-followup-due" className="text-xs font-medium text-muted-foreground">
                            Data e hora do retorno
                        </label>
                        <Input
                            id="manual-followup-due"
                            type="datetime-local"
                            value={dueAt}
                            onChange={(event) => setDueAt(event.target.value)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="grid min-w-0 flex-[2] gap-1.5">
                        <label htmlFor="manual-followup-description" className="text-xs font-medium text-muted-foreground">
                            O que fazer
                        </label>
                        <Input
                            id="manual-followup-description"
                            placeholder="Ex.: Ligar para confirmar a visita"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            disabled={isPending}
                        />
                    </div>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Agendando..." : "Agendar retorno"}
                    </Button>
                </form>
            ) : null}

            <div className="mt-4 space-y-4">
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Vencidos ({groups.overdue.length})
                    </div>
                    <div className="mt-2 space-y-2">
                        {groups.overdue.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum retorno vencido.</p>
                        ) : (
                            groups.overdue.map(renderRow)
                        )}
                    </div>
                </div>
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Próximos ({groups.upcoming.length})
                    </div>
                    <div className="mt-2 space-y-2">
                        {groups.upcoming.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum retorno agendado.</p>
                        ) : (
                            groups.upcoming.map(renderRow)
                        )}
                    </div>
                </div>
                {groups.done.length > 0 ? (
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Encerrados ({groups.done.length})
                        </div>
                        <div className="mt-2 space-y-2">{groups.done.map(renderRow)}</div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
