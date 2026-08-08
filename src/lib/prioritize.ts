import { differenceInCalendarDays, differenceInHours } from "date-fns"

import type { Document, OpenItem, Return, Role, Severity } from "@/types"
import { getOpenItemsForReturn, getQuestionnaireItemsForReturn, getReturn, getThreadsForObject } from "@/data/fixtures"

/**
 * A client's three home-page states, derived from their own data rather than a manual
 * toggle — see ClientHome. "new" and "complete" are about the client's own onboarding work
 * (documents + questionnaire), not the return's overall ClientPhase — a return can be
 * onboarding-complete and still be mid-review with the firm.
 */
export type OnboardingStage = "new" | "in-progress" | "complete"

export function getOnboardingStage(ret: Return, documents: Document[]): OnboardingStage {
  if (documents.length === 0) return "new"
  const unresolvedItems = getOpenItemsForReturn(ret.id).filter((i) => i.resolvedAt === null)
  const requiredQuestions = getQuestionnaireItemsForReturn(ret.id).filter((q) => q.required)
  const questionnaireComplete = requiredQuestions.every((q) => q.answer !== null)
  return unresolvedItems.length === 0 && questionnaireComplete ? "complete" : "in-progress"
}

export interface ClientTask {
  id: string
  title: string
  description: string
  to: string
  severity: Severity
  dueDate: string | null
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

/**
 * Everything currently asking for the client's action — unresolved open items assigned to
 * them, plus required questionnaire answers still missing. Firm-owned open items don't
 * belong here: they're real, but there's nothing for the client to do about them.
 */
export function getClientTasks(ret: Return): ClientTask[] {
  const items: ClientTask[] = getOpenItemsForReturn(ret.id)
    .filter((i) => i.owner === "client" && i.resolvedAt === null)
    .map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      to: `/returns/${ret.id}/items?item=${i.id}`,
      severity: i.severity,
      dueDate: i.dueDate,
    }))

  const questions: ClientTask[] = getQuestionnaireItemsForReturn(ret.id)
    .filter((q) => q.required && q.answer === null)
    .map((q) => ({
      id: q.id,
      title: "Answer a question about your return",
      description: q.question,
      to: `/questionnaire/${q.sectionId}`,
      severity: "high" as const,
      dueDate: null,
    }))

  return [...items, ...questions].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (bySeverity !== 0) return bySeverity
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    return a.dueDate ? -1 : b.dueDate ? 1 : 0
  })
}

export function getNextClientTask(ret: Return): ClientTask | null {
  return getClientTasks(ret)[0] ?? null
}

// ---------------------------------------------------------------------------
// Staff-side scoring — the same OpenItems as above, ranked for firm staff instead of the
// client. Every tunable number lives in WEIGHTS and ROLE_WEIGHT_MULTIPLIERS right below, so
// the whole ranking model reads in one place instead of being scattered through the six
// factor functions that use it.
// ---------------------------------------------------------------------------

const SCORE_FACTORS = ["deadline", "severity", "ownership", "staleness", "unblocking", "clientResponse"] as const
type ScoreFactor = (typeof SCORE_FACTORS)[number]
type FactorWeights = Record<ScoreFactor, number>

/** Points each factor contributes at full strength. Tune ranking behavior here, not in the
 * factor math below. */
const WEIGHTS: FactorWeights = {
  deadline: 40,
  severity: 20,
  ownership: 15,
  staleness: 15,
  unblocking: 15,
  clientResponse: 25,
}

/** Client roles never work an open-item queue — rankForRole only makes sense for the rest. */
type StaffRole = Exclude<Role, "individual" | "business-owner">

/**
 * Same six factors, different emphasis per role. A preparer's queue should surface their own
 * at-risk work first, so ownership counts for more. A manager (reviewer/firm-admin) is
 * scanning the whole team for what's stuck, stale, or at risk regardless of who it's assigned
 * to — staleness and unblocking value count for more, ownership for less.
 */
const ROLE_WEIGHT_MULTIPLIERS: Record<StaffRole, FactorWeights> = {
  preparer: { deadline: 1, severity: 1, ownership: 2, staleness: 0.4, unblocking: 1, clientResponse: 1.25 },
  seasonal: { deadline: 1, severity: 1, ownership: 2, staleness: 0.4, unblocking: 1, clientResponse: 1.25 },
  reviewer: { deadline: 1, severity: 1.25, ownership: 0.5, staleness: 1.5, unblocking: 1.25, clientResponse: 1 },
  "firm-admin": { deadline: 1, severity: 1.25, ownership: 0.5, staleness: 1.5, unblocking: 1.25, clientResponse: 1 },
}

export interface Reason {
  factor: ScoreFactor
  /** Staff-facing and precise — "Client responded 2h ago", not "The client got back to you." */
  label: string
  /** This reason's actual point contribution, so the UI can size or order chips by impact. */
  points: number
}

export interface ScoringContext {
  now: Date
  userId: string
  /** Defaults to WEIGHTS. rankForRole supplies a role-adjusted set here. */
  weights?: FactorWeights
}

export interface ScoredItem {
  item: OpenItem
  score: number
  reasons: Reason[]
}

interface FactorResult {
  points: number
  /** Null when this factor didn't meaningfully contribute — see scoreItem. */
  reason: Reason | null
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

/** Every message across whatever threads are scoped to this item — its activity log. */
function itemMessages(item: OpenItem) {
  return getThreadsForObject({ type: "item", id: item.id }).flatMap((t) => t.messages)
}

/** The single most recent message on this item, if any activity exists at all. Staleness and
 * clientResponse both read off this — same fact, two different questions asked about it. */
function latestMessage(item: OpenItem) {
  const messages = itemMessages(item)
  if (messages.length === 0) return null
  return messages.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest))
}

// --- Factors -----------------------------------------------------------------------------

/** Steep curve inside 7 days: a quadratic ramp up to the due date means the last day or two
 * dominate, then it keeps climbing linearly for anything overdue — a 1-day-late item still
 * outranks one that's merely 6 days out. */
function deadlineFactor(item: OpenItem, ctx: ScoringContext, weight: number): FactorResult {
  const daysUntilDue = differenceInCalendarDays(new Date(item.dueDate), ctx.now)
  const t = (7 - daysUntilDue) / 7
  if (t <= 0) return { points: 0, reason: null }
  const curve = t <= 1 ? t ** 2 : t
  const points = weight * curve
  const label =
    daysUntilDue < 0
      ? `${plural(-daysUntilDue, "day")} overdue`
      : daysUntilDue === 0
        ? "Due today"
        : `Due in ${plural(daysUntilDue, "day")}`
  return { points, reason: { factor: "deadline", label, points } }
}

const SEVERITY_POINTS: Record<Severity, number> = { high: 1, medium: 0.6, low: 0.3 }

/** Low severity is the baseline — it still contributes a small amount of score, but doesn't
 * earn a chip explaining the ranking. Medium and high do. */
function severityFactor(item: OpenItem, weight: number): FactorResult {
  const points = weight * SEVERITY_POINTS[item.severity]
  if (item.severity === "low") return { points, reason: null }
  const label = `${item.severity === "high" ? "High" : "Medium"} severity`
  return { points, reason: { factor: "severity", label, points } }
}

/** Is this waiting on the viewing user specifically, or on someone else? Assigned-elsewhere
 * contributes nothing — it's real work, just not this person's to see explained. */
function ownershipFactor(item: OpenItem, ctx: ScoringContext, weight: number): FactorResult {
  if (item.assignedTo === ctx.userId) {
    return { points: weight, reason: { factor: "ownership", label: "Assigned to you", points: weight } }
  }
  if (item.assignedTo === null) {
    const points = weight * 0.4
    return { points, reason: { factor: "ownership", label: "Unassigned", points } }
  }
  return { points: 0, reason: null }
}

/** How long since anything happened here. An item whose last activity was the client replying
 * an hour ago isn't stale — it's the opposite (see clientResponseFactor) — so this only fires
 * once activity has gone quiet for at least 5 days. */
function stalenessFactor(item: OpenItem, ctx: ScoringContext, weight: number): FactorResult {
  const last = latestMessage(item)
  if (!last) return { points: 0, reason: null }
  const daysSince = differenceInCalendarDays(ctx.now, new Date(last.sentAt))
  if (daysSince < 5) return { points: 0, reason: null }
  const points = weight * clamp(daysSince / 21, 0, 1.5)
  return { points, reason: { factor: "staleness", label: `No activity in ${plural(daysSince, "day")}`, points } }
}

/** Clearing this item unblocks whatever return fields it's linked to — the more it blocks,
 * the more valuable clearing it is, independent of this item's own severity or deadline. */
function unblockingFactor(item: OpenItem, weight: number): FactorResult {
  const fieldCount = item.linkedObjects.filter((ref) => ref.type === "field").length
  if (fieldCount === 0) return { points: 0, reason: null }
  const points = weight * clamp(fieldCount / 3, 0, 1.5)
  return { points, reason: { factor: "unblocking", label: `Blocks ${plural(fieldCount, "downstream field")}`, points } }
}

/** A hot handoff: the client's reply is the most recent thing that happened on this item, and
 * it happened recently. Decays to nothing over 48 hours — after that it's just staleness. */
function clientResponseFactor(item: OpenItem, ctx: ScoringContext, weight: number): FactorResult {
  const ret = getReturn(item.returnId)
  const last = latestMessage(item)
  if (!ret || !last || last.authorId !== ret.clientId) return { points: 0, reason: null }
  const hoursSince = differenceInHours(ctx.now, new Date(last.sentAt))
  if (hoursSince >= 48) return { points: 0, reason: null }
  const points = weight * clamp(1 - hoursSince / 48, 0, 1)
  const label = `Client responded ${hoursSince < 1 ? "under an hour ago" : `${hoursSince}h ago`}`
  return { points, reason: { factor: "clientResponse", label, points } }
}

// --- Scoring -----------------------------------------------------------------------------

/**
 * Scores one open item and explains itself: every factor that actually moved the score
 * attaches a staff-facing Reason. A factor that didn't contribute — not near its deadline, no
 * activity history, nothing downstream — is silently absent rather than padded in at zero.
 * An unexplained ranking is exactly the black box that sends people back to spreadsheets.
 */
export function scoreItem(item: OpenItem, ctx: ScoringContext): { score: number; reasons: Reason[] } {
  const weights = ctx.weights ?? WEIGHTS
  const results = [
    deadlineFactor(item, ctx, weights.deadline),
    severityFactor(item, weights.severity),
    ownershipFactor(item, ctx, weights.ownership),
    stalenessFactor(item, ctx, weights.staleness),
    unblockingFactor(item, weights.unblocking),
    clientResponseFactor(item, ctx, weights.clientResponse),
  ]
  const score = Math.round(results.reduce((sum, r) => sum + r.points, 0) * 10) / 10
  const reasons = results.flatMap((r) => (r.reason ? [r.reason] : []))
  return { score, reasons }
}

function weightsForRole(role: StaffRole): FactorWeights {
  const multipliers = ROLE_WEIGHT_MULTIPLIERS[role]
  const entries = SCORE_FACTORS.map((factor) => [factor, WEIGHTS[factor] * multipliers[factor]] as const)
  return Object.fromEntries(entries) as FactorWeights
}

/**
 * The same open items, ranked differently depending on who's looking — see
 * ROLE_WEIGHT_MULTIPLIERS for exactly what shifts between a preparer's own-queue view and a
 * manager's team-wide one.
 */
export function rankForRole(items: OpenItem[], role: StaffRole, userId: string): ScoredItem[] {
  const ctx: ScoringContext = { now: new Date(), userId, weights: weightsForRole(role) }
  return items.map((item) => ({ item, ...scoreItem(item, ctx) })).sort((a, b) => b.score - a.score)
}
