"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type Job = {
  id: string
  step: "5m" | "24h" | "3d"
  status: "pending" | "sent" | "failed" | "paused" | "canceled"
  scheduled_at: string
  processed_at: string | null
  error: string | null
}

type Props = {
  contactId: string
  canManage: boolean
  jobs: Job[]
}

const STEP_LABEL: Record<Job["step"], string> = {
  "5m": "5 minutos",
  "24h": "24 horas",
  "3d": "3 dias",
}

const STATUS_LABEL: Record<Job["status"], string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  paused: "Pausado",
  canceled: "Cancelado",
}

function statusClass(status: Job["status"]) {
  if (status === "sent") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "pending") return "bg-sky-100 text-sky-800 border-sky-200"
  if (status === "paused") return "bg-amber-100 text-amber-800 border-amber-200"
  if (status === "failed") return "bg-rose-100 text-rose-800 border-rose-200"
  return "bg-zinc-100 text-zinc-700 border-zinc-200"
}

export function ContactFollowupPanel({ contactId, canManage, jobs }: Props) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<null | "pause" | "resume" | "cancel">(null)
  const hasPending = useMemo(() => jobs.some((j) => j.status === "pending"), [jobs])
  const hasPaused = useMemo(() => jobs.some((j) => j.status === "paused"), [jobs])

  const runAction = async (action: "pause" | "resume" | "cancel") => {
    setLoadingAction(action)
    try {
      const res = await fetch(`/api/followups/contact/${contactId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data?.message || "Falha ao atualizar régua.")

      toast.success(`Ação "${action}" aplicada em ${data.affected ?? 0} follow-ups.`)
      router.refresh()
    } catch (error) {
      console.error("Error running followup action:", error)
      toast.error("Erro ao atualizar a régua deste contato.")
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="rounded-lg border p-4 bg-muted/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Régua de follow-up</h2>
          <p className="text-sm text-muted-foreground">Sequência automática de contato deste lead.</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPending || loadingAction !== null}
              onClick={() => runAction("pause")}
            >
              {loadingAction === "pause" ? "Pausando..." : "Pausar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPaused || loadingAction !== null}
              onClick={() => runAction("resume")}
            >
              {loadingAction === "resume" ? "Retomando..." : "Retomar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loadingAction !== null}
              onClick={() => runAction("cancel")}
            >
              {loadingAction === "cancel" ? "Cancelando..." : "Cancelar"}
            </Button>
          </div>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <div className="mt-4 rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Nenhum follow-up agendado para este contato.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{STEP_LABEL[job.step]}</div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(job.status)}`}>
                  {STATUS_LABEL[job.status]}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Agendado: {new Date(job.scheduled_at).toLocaleString("pt-BR")}
              </div>
              {job.processed_at ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Processado: {new Date(job.processed_at).toLocaleString("pt-BR")}
                </div>
              ) : null}
              {job.error ? <div className="mt-1 text-xs text-rose-700">{job.error}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

