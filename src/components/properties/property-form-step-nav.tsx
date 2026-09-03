"use client"

import { Badge } from "@/components/ui/badge"
import {
  PROPERTY_FORM_STEPS,
  type PropertyFormStepId,
  type PropertyFormStepIssueCounts,
} from "@/lib/properties/property-form-steps"

type PropertyFormStepNavProps = {
  activeStep: PropertyFormStepId
  issueCounts: PropertyFormStepIssueCounts
  onStepChange: (step: PropertyFormStepId) => void
}

export function PropertyFormStepNav({
  activeStep,
  issueCounts,
  onStepChange,
}: PropertyFormStepNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROPERTY_FORM_STEPS.map((step) => {
        const issueCount = issueCounts[step.id]
        const isActive = step.id === activeStep

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            className={`inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <span>{step.shortLabel}</span>
            {issueCount > 0 ? (
              <Badge variant="outline" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {issueCount}
              </Badge>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
