import { useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowRight, Users } from "lucide-react"
import { format } from "date-fns"

import type { Severity } from "@/types"
import { getOpenItems, getReturn, getUser } from "@/data/fixtures"
import { getEffectiveRole, useRoleStore } from "@/stores/useRoleStore"
import { can } from "@/lib/permissions"
import {
  daysSinceLastActivity,
  getItemDeepLink,
  getPrimaryLinkedField,
  isStaffRole,
  rankForRole,
  type Reason,
  type ScoredItem,
} from "@/lib/prioritize"
import { returnLabel } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { StaffStateChip } from "@/components/status/StaffStateChip"
import { FieldBox } from "@/components/field/FieldBox"

const QUEUE_VISIBLE_COUNT = 20
const QUEUE_ROW_HEIGHT = 68

const DEEP_LINK_ACTION_LABEL: Record<ReturnType<typeof getItemDeepLink>["kind"], string> = {
  field: "Review this field",
  document: "Open this document",
  item: "Open this item",
}

function topReason(reasons: Reason[]): Reason | null {
  if (reasons.length === 0) return null
  return reasons.reduce((best, r) => (r.points > best.points ? r : best))
}

function ReasonChip({ reason, compact = false }: { reason: Reason; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border border-border bg-panel text-ink/80",
        compact ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs font-medium"
      )}
    >
      {reason.label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide",
        severity === "high"
          ? "border-state-needs-review-border bg-state-needs-review-fill text-state-needs-review-text"
          : "border-border text-ink/60"
      )}
    >
      {severity}
    </span>
  )
}

/**
 * The single top-ranked item, rendered large. This is the algorithm's actual pick — it never
 * changes with the queue's sort control below, so "work on this next" always means exactly
 * that, not whatever the queue happens to be sorted by right now.
 */
function TopPickCard({ scored }: { scored: ScoredItem }) {
  const { item, score, reasons } = scored
  const ret = getReturn(item.returnId)
  const field = getPrimaryLinkedField(item)
  const deepLink = getItemDeepLink(item)
  if (!ret) return null

  return (
    <section className="rounded-sm border-2 border-ink p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/50">Work on this next</p>
        <span className="font-mono text-xs tabular-nums text-ink/40" title="Ranking score">
          {score}
        </span>
      </div>

      <h2 className="mt-2 font-display text-xl font-bold leading-snug">{item.title}</h2>
      <p className="mt-1.5 max-w-prose text-sm text-ink/70">{item.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to={`/returns/${ret.id}`}
          className="text-sm font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
        >
          {returnLabel(ret)}
        </Link>
        <StaffStateChip ret={ret} />
        <SeverityBadge severity={item.severity} />
        <span className="font-mono text-xs tabular-nums text-ink/50">
          Due {format(new Date(item.dueDate), "MMM d, yyyy")}
        </span>
      </div>

      {reasons.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <ReasonChip key={r.factor} reason={r} />
          ))}
        </div>
      )}

      {field && (
        <div className="mt-4">
          <FieldBox state={field.state} label={field.label} value={field.value} size="sm" />
        </div>
      )}

      <Link
        to={deepLink.to}
        className="mt-5 inline-flex items-center gap-2 rounded-sm border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {DEEP_LINK_ACTION_LABEL[deepLink.kind]}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}

type QueueSort = "score" | "deadline" | "severity"

const QUEUE_SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "deadline", label: "Deadline" },
  { value: "severity", label: "Severity" },
]

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

/** Reordering here never re-scores anything — it's the same 20 items, resorted by a field the
 * viewer can check the ranking against. That's what makes the ranking inspectable rather than
 * magic: flip to "Deadline" and see for yourself whether the top of the queue actually lines
 * up with what's due soonest. */
function sortQueue(items: ScoredItem[], sort: QueueSort): ScoredItem[] {
  if (sort === "score") return items
  const sorted = [...items]
  if (sort === "deadline") {
    sorted.sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime())
  } else {
    sorted.sort((a, b) => SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity])
  }
  return sorted
}

function QueueRow({ rank, scored }: { rank: number; scored: ScoredItem }) {
  const { item, score, reasons } = scored
  const ret = getReturn(item.returnId)
  if (!ret) return null
  const reason = topReason(reasons)

  return (
    <Link
      to={getItemDeepLink(item).to}
      className="flex h-full items-center gap-3 border-b border-border px-3 py-2 hover:bg-panel"
    >
      <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-ink/40">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-ink/50">{returnLabel(ret)}</p>
      </div>
      {reason && <ReasonChip reason={reason} compact />}
      <SeverityBadge severity={item.severity} />
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-ink/50">{score}</span>
    </Link>
  )
}

/** Virtualized so the row count is decoupled from render cost — proven against the full
 * unresolved-item dataset (72 items today), not just the 20 actually shown. */
function RankedQueueList({ items }: { items: ScoredItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => QUEUE_ROW_HEIGHT,
    overscan: 6,
  })

  return (
    <div ref={parentRef} className="h-[420px] overflow-y-auto rounded-sm border border-border">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const scored = items[virtualRow.index]
          return (
            <div
              key={scored.item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <QueueRow rank={virtualRow.index + 2} scored={scored} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WaitingRow({ scored }: { scored: ScoredItem }) {
  const { item } = scored
  const ret = getReturn(item.returnId)
  if (!ret) return null

  return (
    <li className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-ink/50">{returnLabel(ret)}</p>
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-ink/50">
        Due {format(new Date(item.dueDate), "MMM d")}
      </span>
      <Link
        to={getItemDeepLink(item).to}
        className="shrink-0 rounded-sm border border-border px-2.5 py-1 text-xs font-medium hover:bg-panel"
      >
        Nudge
      </Link>
    </li>
  )
}

/**
 * Everything currently waiting on the client, not on the firm — resolving it means getting a
 * response, not doing the work yourself. That's a different action than the ranked queue above
 * (nudge, not do), so it gets its own section rather than being mixed in and competing for
 * the same "work on this" framing.
 */
function WaitingSection({ items }: { items: ScoredItem[] }) {
  return (
    <section>
      <h2 className="font-display text-sm font-semibold uppercase tracking-widest">
        Waiting on the client{items.length > 0 ? ` (${items.length})` : ""}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink/50">Nothing is waiting on the client right now.</p>
      ) : (
        <ul className="mt-2 max-h-80 overflow-y-auto rounded-sm border border-border">
          {items.map((scored) => (
            <WaitingRow key={scored.item.id} scored={scored} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PerPreparerLoad({ items }: { items: ScoredItem[] }) {
  const groups = useMemo(() => {
    const byAssignee = new Map<string | null, ScoredItem[]>()
    for (const scored of items) {
      const key = scored.item.assignedTo
      const list = byAssignee.get(key) ?? []
      list.push(scored)
      byAssignee.set(key, list)
    }
    const unassigned = byAssignee.get(null) ?? []
    const assigned = [...byAssignee.entries()]
      .filter((entry): entry is [string, ScoredItem[]] => entry[0] !== null)
      .map(([userId, list]) => ({ userId, list }))
      .sort((a, b) => b.list.length - a.list.length)
    return { unassigned, assigned }
  }, [items])

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Per-preparer load</h3>
      <ul className="mt-2 divide-y divide-border rounded-sm border border-border">
        {groups.unassigned.length > 0 && (
          <li className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-sm font-medium text-state-needs-review-text">Unassigned</span>
            <span className="font-mono text-xs tabular-nums text-ink/60">
              {groups.unassigned.length} open
            </span>
          </li>
        )}
        {groups.assigned.map(({ userId, list }) => (
          <li key={userId} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="truncate text-sm">{getUser(userId)?.name ?? userId}</span>
            <span className="font-mono text-xs tabular-nums text-ink/60">{list.length} open</span>
          </li>
        ))}
        {groups.assigned.length === 0 && groups.unassigned.length === 0 && (
          <li className="px-3 py-2 text-sm text-ink/50">No open work assigned across the team.</li>
        )}
      </ul>
    </section>
  )
}

function OldestUntouched({ items }: { items: ScoredItem[] }) {
  const oldest = useMemo(() => {
    const now = new Date()
    let best: { scored: ScoredItem; days: number } | null = null
    for (const scored of items) {
      const days = daysSinceLastActivity(scored.item, now)
      if (days !== null && (best === null || days > best.days)) best = { scored, days }
    }
    return best
  }, [items])

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Oldest untouched item</h3>
      {!oldest ? (
        <p className="mt-2 text-sm text-ink/50">No activity history recorded for any open item yet.</p>
      ) : (
        <div className="mt-2 rounded-sm border border-border p-3">
          <p className="text-sm font-medium">{oldest.scored.item.title}</p>
          <p className="mt-0.5 text-xs text-ink/50">
            {getReturn(oldest.scored.item.returnId) ? returnLabel(getReturn(oldest.scored.item.returnId)!) : ""} ·{" "}
            {oldest.days} days since last activity
          </p>
          <Link
            to={getItemDeepLink(oldest.scored.item).to}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
          >
            Open <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  )
}

function AtRiskDeadlines({ items }: { items: ScoredItem[] }) {
  const atRisk = useMemo(() => {
    return items
      .map((scored) => ({ scored, reason: scored.reasons.find((r) => r.factor === "deadline") ?? null }))
      .filter((x): x is { scored: ScoredItem; reason: Reason } => x.reason !== null)
      .sort((a, b) => b.reason.points - a.reason.points)
      .slice(0, 8)
  }, [items])

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest">At-risk deadlines</h3>
      {atRisk.length === 0 ? (
        <p className="mt-2 text-sm text-ink/50">Nothing due or overdue across the team right now.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-sm border border-border">
          {atRisk.map(({ scored, reason }) => {
            const ret = getReturn(scored.item.returnId)
            return (
              <li key={scored.item.id}>
                <Link
                  to={getItemDeepLink(scored.item).to}
                  className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-panel"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{scored.item.title}</span>
                  {ret && <span className="shrink-0 text-xs text-ink/50">{returnLabel(ret)}</span>}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-ink/60">{reason.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Per-preparer load, oldest untouched item, at-risk deadlines — the same rankForRole output
 * as the personal queue (already weighted for this viewer's role), just aggregated across the
 * whole team instead of framed as one person's next action. */
function TeamView({ items }: { items: ScoredItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      <PerPreparerLoad items={items} />
      <OldestUntouched items={items} />
      <AtRiskDeadlines items={items} />
    </div>
  )
}

/**
 * /home for staff roles. Organized around one question — what do I work on right now — not
 * reporting: no charts, no vanity counts. rankForRole already resolves the whole ranking
 * (score + reasons) for the viewer's role in one pass over every unresolved open item; this
 * page only decides how to present that ranking, never re-derives it.
 */
export function StaffHome() {
  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const userId = useRoleStore((s) => s.userId)
  const effectiveRole = getEffectiveRole(role, context)

  const [teamViewOn, setTeamViewOn] = useState(false)
  const [queueSort, setQueueSort] = useState<QueueSort>("score")

  const canManage = can(effectiveRole, "canViewAllReturns")
  const showTeamView = canManage && teamViewOn

  const ranked = useMemo(() => {
    if (!isStaffRole(effectiveRole)) return []
    const unresolved = getOpenItems().filter((i) => i.resolvedAt === null)
    return rankForRole(unresolved, effectiveRole, userId)
  }, [effectiveRole, userId])

  const firmRanked = useMemo(() => ranked.filter((r) => r.item.owner === "firm"), [ranked])
  const waitingItems = useMemo(() => ranked.filter((r) => r.item.owner === "client"), [ranked])

  const topPick = firmRanked[0] ?? null
  const queue = useMemo(
    () => sortQueue(firmRanked.slice(1, 1 + QUEUE_VISIBLE_COUNT), queueSort),
    [firmRanked, queueSort]
  )

  return (
    <main className="mx-auto max-w-4xl p-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-widest text-ink/60">Your queue</p>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">Work</h1>
        </div>
        {canManage && (
          <div className="flex rounded-sm border border-border p-0.5 text-sm" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={!teamViewOn}
              onClick={() => setTeamViewOn(false)}
              className={cn(
                "rounded-[2px] px-2.5 py-1 font-medium",
                !teamViewOn ? "bg-ink text-paper" : "opacity-60 hover:opacity-100"
              )}
            >
              My queue
            </button>
            <button
              type="button"
              aria-pressed={teamViewOn}
              onClick={() => setTeamViewOn(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-[2px] px-2.5 py-1 font-medium",
                teamViewOn ? "bg-ink text-paper" : "opacity-60 hover:opacity-100"
              )}
            >
              <Users className="size-3.5" aria-hidden="true" />
              Team view
            </button>
          </div>
        )}
      </header>

      {ranked.length === 0 ? (
        <div className="rounded-sm border border-border p-8 text-center">
          <p className="font-medium">Queue is clear.</p>
          <p className="mt-1 text-sm text-ink/60">
            New items appear here as documents come in and returns move through review.
          </p>
        </div>
      ) : showTeamView ? (
        <TeamView items={ranked} />
      ) : (
        <div className="space-y-8">
          {topPick ? (
            <TopPickCard scored={topPick} />
          ) : (
            <div className="rounded-sm border border-border p-8 text-center">
              <p className="font-medium">Nothing needs you right now.</p>
              <p className="mt-1 text-sm text-ink/60">
                Every open item is currently waiting on the client — see below.
              </p>
            </div>
          )}

          {queue.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="font-display text-sm font-semibold uppercase tracking-widest">
                  Ranked queue ({firmRanked.length - 1} more)
                </h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-ink/50">Sort</span>
                  <div className="flex rounded-sm border border-border p-0.5 text-xs">
                    {QUEUE_SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={queueSort === opt.value}
                        onClick={() => setQueueSort(opt.value)}
                        className={cn(
                          "rounded-[2px] px-2 py-1 font-medium",
                          queueSort === opt.value ? "bg-ink text-paper" : "opacity-60 hover:opacity-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <RankedQueueList items={queue} />
            </section>
          )}

          <WaitingSection items={waitingItems} />
        </div>
      )}
    </main>
  )
}

export default StaffHome
