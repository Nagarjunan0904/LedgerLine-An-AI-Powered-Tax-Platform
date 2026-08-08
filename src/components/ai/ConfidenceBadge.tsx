import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/provenance"
import { cn } from "@/lib/utils"

export interface ConfidenceBadgeProps {
  /** 0–1 */
  confidence: number
  className?: string
}

/**
 * A raw 0.71 means nothing to a preparer at 9pm. Three plain-language bands, the number
 * shown only secondarily — the same three-tier split explainField's recommendedAction uses
 * (accept/review/needs-human), so the badge and the recommendation always agree.
 */
const BANDS = [
  {
    min: 0.95,
    label: "High confidence",
    className: "border-state-verified-border bg-state-verified-fill text-state-verified-text",
  },
  {
    min: LOW_CONFIDENCE_THRESHOLD,
    label: "Worth checking",
    className: "border-state-ai-suggested-border bg-state-ai-suggested-fill text-state-ai-suggested-text",
  },
  {
    min: 0,
    label: "Needs your eyes",
    className: "border-state-needs-review-border bg-state-needs-review-fill text-state-needs-review-text",
  },
]

function bandFor(confidence: number) {
  return BANDS.find((band) => confidence >= band.min) ?? BANDS[BANDS.length - 1]
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const band = bandFor(confidence)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        band.className,
        className
      )}
    >
      {band.label}
      <span className="font-mono text-[0.6875rem] tabular-nums opacity-70">
        {Math.round(confidence * 100)}%
      </span>
    </span>
  )
}

export default ConfidenceBadge
