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

/**
 * Horizontal 5-step progress across CLIENT_PHASES — the only status vocabulary a client ever
 * sees. StaffState never appears here; getNextAction() already resolves state + blockers down
 * to a plain-language description before this component touches it, so there's no internal
 * detail left to accidentally leak.
 */
export function ClientPhaseBar({ ret }: { ret: Return }) {
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
                  className={cn("mt-3.5 h-px flex-1", i <= currentIndex ? "bg-ink" : "bg-border")}
                />
              )}
              <li className="flex shrink-0 flex-col items-center gap-1.5">
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs tabular-nums",
                    done && "border-ink bg-ink text-paper",
                    isCurrent && "border-ink bg-paper text-ink ring-2 ring-ring",
                    !done && !isCurrent && "border-border bg-paper text-ink/40"
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "max-w-24 text-center text-xs leading-tight",
                    isCurrent ? "font-semibold text-ink" : "text-ink/50"
                  )}
                >
                  {phaseInfo.label}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>

      <div className="mt-5 rounded-sm border border-border bg-panel/40 p-4">
        <p className="font-display text-sm font-semibold uppercase tracking-wide">{current.label}</p>
        <p className="mt-1 text-sm text-ink/70">{current.description}</p>
        <div className="mt-3 flex items-center gap-2">
          <OwnerPill owner={nextAction.owner} />
          <p className={cn("text-sm", blocked ? "text-ink" : "text-ink/70")}>{nextAction.description}</p>
        </div>
      </div>
    </div>
  )
}

export default ClientPhaseBar
