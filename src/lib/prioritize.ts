import type { Document, Return, Severity } from "@/types"
import { getOpenItemsForReturn, getQuestionnaireItemsForReturn } from "@/data/fixtures"

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
