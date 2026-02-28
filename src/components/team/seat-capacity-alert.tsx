"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SeatCapacityAlert } from "@/lib/team/billing"

type Props = {
  alert: SeatCapacityAlert
  ctaHref?: string
}

export function SeatCapacityAlert({ alert, ctaHref = "/settings/billing" }: Props) {
  const classes =
    alert.level === "limit"
      ? "border-rose-300 bg-rose-50 text-rose-800"
      : "border-amber-300 bg-amber-50 text-amber-800"

  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Alerta de capacidade</p>
            <p className="text-sm">{alert.message}</p>
          </div>
        </div>
        <Button asChild size="sm" variant={alert.level === "limit" ? "default" : "outline"}>
          <Link href={ctaHref}>Solicitar upgrade</Link>
        </Button>
      </div>
    </div>
  )
}

