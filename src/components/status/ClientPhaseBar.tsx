import { Fragment } from "react"
import { Check } from "lucide-react"

import type { Return } from "@/types"
import { CLIENT_PHASES, getBlockers, getNextAction } from "@/lib/status"
import { cn } from "@/lib/utils"

function OwnerPill({ owner }: { owner: "client" | "firm" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide",
        owner === "client" ? "border-ink bg-ink text-paper" : "border-border opacity-70"
      )}
    >
      {owner === "client" ? "Your turn" : "Our turn"}
    </span>
  )
}

export interface ClientPhaseBarProps {
  ret: Return
  /** Smaller circles, no phase description paragraph — for contexts like ClientHome's "in
   * progress" state where the bar is a supporting element, not the page's main content. */
  compact?: boolean
}

/**
 * Horizontal 5-step progress across CLIENT_PHASES — the only status vocabulary a client ever
 * sees. StaffState never appears here; getNextAction() already resolves state + blockers down
 * to a plain-language description before this component touches it, so there's no internal
 * detail left to accidentally leak.
 */
export function ClientPhaseBar({ ret, compact = false }: ClientPhaseBarProps) {
  const currentIndex = CLIENT_PHASES.findIndex((p) => p.phase === ret.clientPhase)
  const current = CLIENT_PHASES[currentIndex]
  const nextAction = getNextAction(ret)
  const blocked = getBlockers(ret).length > 0

  return (
    <div>
      <ol className="flex items-start" aria-label="Return progress">
        {CLIENT_PHASES.map((phaseInfo, i) => {
          const done = i < currentIndex
          const isCurrent = i === currentIndex
          return (
            <Fragment key={phaseInfo.phase}>
              {i > 0 && (
                <div
                  aria-hidden="true"
                  className={cn(compact ? "mt-3" : "mt-3.5", "h-px flex-1", i <= currentIndex ? "bg-ink" : "bg-border")}
                />
              )}
              <li className="flex shrink-0 flex-col items-center gap-1.5">
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full border font-mono tabular-nums",
                    compact ? "size-6 text-[0.6875rem]" : "size-7 text-xs",
                    done && "border-ink bg-ink text-paper",
                    isCurrent && "border-ink bg-paper text-ink ring-2 ring-ring",
                    !done && !isCurrent && "border-border bg-paper text-ink/40"
                  )}
                >
                  {done ? <Check className={compact ? "size-3" : "size-3.5"} aria-hidden="true" /> : i + 1}
                </div>
                {!compact && (
                  <span
                    className={cn(
                      "max-w-24 text-center text-xs leading-tight",
                      isCurrent ? "font-semibold text-ink" : "text-ink/50"
                    )}
                  >
                    {phaseInfo.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>

      <div className={cn("rounded-sm border border-border bg-panel/40", compact ? "mt-3 p-3" : "mt-5 p-4")}>
        <p className="font-display text-sm font-semibold uppercase tracking-wide">{current.label}</p>
        {!compact && <p className="mt-1 text-sm text-ink/70">{current.description}</p>}
        <div className="mt-3 flex items-center gap-2">
          <OwnerPill owner={nextAction.owner} />
          <p className={cn("text-sm", blocked ? "text-ink" : "text-ink/70")}>{nextAction.description}</p>
        </div>
      </div>
    </div>
  )
}

export default ClientPhaseBar
