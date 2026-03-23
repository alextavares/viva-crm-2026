'use client'

import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from '@/lib/types'
import { cn } from '@/lib/utils'

const STAGE_COLORS: Record<DealStage, string> = {
    lead: 'bg-slate-100 text-slate-700 border-slate-200',
    interest: 'bg-blue-100 text-blue-700 border-blue-200',
    visit: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    negotiation: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    closing: 'bg-orange-100 text-orange-700 border-orange-200',
    won: 'bg-green-100 text-green-800 border-green-200',
    lost: 'bg-red-100 text-red-700 border-red-200',
}

interface DealStageBadgeProps {
    stage: string | null | undefined
    className?: string
}

export function DealStageBadge({ stage, className }: DealStageBadgeProps) {
    const safeStage = (DEAL_STAGES.includes(stage as DealStage) ? stage : 'lead') as DealStage
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                STAGE_COLORS[safeStage],
                className
            )}
        >
            {DEAL_STAGE_LABELS[safeStage]}
        </span>
    )
}
