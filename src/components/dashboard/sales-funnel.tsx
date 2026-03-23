'use client'

import { DEAL_STAGE_LABELS, type DealStage } from '@/lib/types'

interface FunnelStage {
    stage: DealStage
    count: number
}

interface SalesFunnelProps {
    stages: FunnelStage[]
}

const STAGE_CONFIG: Array<{ stage: DealStage; color: string; barColor: string }> = [
    { stage: 'lead', color: 'text-slate-600 dark:text-slate-300', barColor: 'bg-slate-300 dark:bg-slate-700' },
    { stage: 'interest', color: 'text-blue-700 dark:text-blue-300', barColor: 'bg-blue-300 dark:bg-blue-800' },
    { stage: 'visit', color: 'text-indigo-700 dark:text-indigo-300', barColor: 'bg-indigo-300 dark:bg-indigo-800' },
    { stage: 'negotiation', color: 'text-violet-700 dark:text-violet-300', barColor: 'bg-violet-300 dark:bg-violet-800' },
    { stage: 'closing', color: 'text-amber-700 dark:text-amber-300', barColor: 'bg-amber-300 dark:bg-amber-800' },
    { stage: 'won', color: 'text-emerald-800 dark:text-emerald-300', barColor: 'bg-emerald-400 dark:bg-emerald-700' },
]

export function SalesFunnel({ stages }: SalesFunnelProps) {
    // Garantir que as contagens fiquem ordenadas do topo da array
    const stageMap = Object.fromEntries(stages.map(s => [s.stage, s.count]))

    // Smooth the funnel so it always looks somewhat like a funnel even with weird data
    // We force a minimum width that decreases down the funnel
    const counts = STAGE_CONFIG.map(({ stage }) => stageMap[stage] ?? 0)
    const maxRealCount = Math.max(1, ...counts)

    return (
        <div className="flex flex-col items-center w-full gap-[2px] pt-2">
            {STAGE_CONFIG.map(({ stage, color, barColor }, index) => {
                const count = stageMap[stage] ?? 0

                // Real percentage relative to max
                const realPct = (count / maxRealCount) * 100

                // Visual funnel smoothing: minimum width based on stage position to maintain funnel shape
                const baseMinPct = 100 - (index * 12) // 100, 88, 76, 64, 52, 40
                const visualPct = Math.max(baseMinPct, realPct)

                return (
                    <div
                        key={stage}
                        className="relative flex items-center justify-center w-full h-10 group"
                    >
                        {/* Background bar centered to look like a funnel slice */}
                        <div
                            className={`absolute h-full transition-all duration-700 ease-in-out ${barColor} 
                                ${index === 0 ? 'rounded-t-md' : ''} 
                                ${index === STAGE_CONFIG.length - 1 ? 'rounded-b-md' : ''}
                                opacity-60 group-hover:opacity-80
                            `}
                            style={{ width: `${visualPct}%` }}
                        />

                        {/* Content text */}
                        <div className="z-10 flex w-full justify-between items-center px-4 max-w-[90%]">
                            <span className={`text-xs sm:text-sm font-semibold tracking-tight ${color} truncate`}>
                                {DEAL_STAGE_LABELS[stage]}
                            </span>
                            <span className="text-sm sm:text-base font-bold text-foreground bg-background/50 backdrop-blur-sm px-2 py-0.5 rounded-full min-w-8 text-center shrink-0">
                                {count}
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
