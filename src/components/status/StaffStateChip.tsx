import { Flag } from "lucide-react"

import type { Return } from "@/types"
import { getBlockers, getNextAction, STAFF_STATES } from "@/lib/status"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * The 9-StaffState view, for firm staff only — pairs with ClientPhaseBar, which shows the
 * same return's 5-phase client-facing summary. Hover/focus for what must happen to advance;
 * unlike the client view, the tooltip is allowed to name the actual blocker reason since
 * this audience is internal.
 */
export function StaffStateChip({ ret }: { ret: Return }) {
  const info = STAFF_STATES.find((s) => s.state === ret.staffState)!
  const blockers = getBlockers(ret)
  const nextAction = getNextAction(ret)
  const blocked = blockers.length > 0

  const ariaLabel = `${info.label}, owned by ${info.owner}${blocked ? `, ${blockers.length} blocker${blockers.length > 1 ? "s" : ""}` : ""}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          aria-label={ariaLabel}
          className="inline-flex items-center gap-2 rounded-sm border border-border bg-paper px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium">{info.label}</span>
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide",
              info.owner === "client" ? "border-ink bg-ink text-paper" : "border-border opacity-70"
            )}
          >
            {info.owner === "client" ? "Client" : "Firm"}
          </span>
          {blocked && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-state-needs-review-border bg-state-needs-review-fill px-1.5 py-0.5 text-[0.6875rem] font-medium text-state-needs-review-text">
              <Flag className="size-3" aria-hidden="true" />
              {blockers.length > 1 ? `${blockers.length} blockers` : "Blocked"}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{nextAction.description}</p>
        {blocked && (
          <ul className="mt-1 list-disc space-y-0.5 pl-3">
            {blockers.map((b) => (
              <li key={b.id}>{b.reason}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export default StaffStateChip
