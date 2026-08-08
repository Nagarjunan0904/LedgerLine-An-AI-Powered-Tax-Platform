import type { Blocker, ClientPhase, Return, StaffState } from "@/types"

/**
 * The two-tier status model: 9 internal StaffStates roll up to 5 client-facing
 * ClientPhases (many-to-one). Clients never see a StaffState — only the phase it maps to,
 * its plain-language description, and who owns the next move. Blocking is tracked
 * separately on Return.blockers and must never become a status value of its own.
 */

export interface ClientPhaseInfo {
  phase: ClientPhase
  label: string
  description: string
  owner: "client" | "firm"
}

export interface StaffStateInfo {
  state: StaffState
  label: string
  owner: "client" | "firm"
  clientPhase: ClientPhase
}

export interface NextAction {
  description: string
  owner: "client" | "firm"
}

/** Order matches the ClientPhase union in src/types/return.ts — a client's return moves
 * left to right through these five, never skipping or reversing. */
export const CLIENT_PHASES: ClientPhaseInfo[] = [
  {
    phase: "gathering-documents",
    label: "Gathering your documents",
    description: "We're collecting the tax documents we need from you.",
    owner: "client",
  },
  {
    phase: "reviewing",
    label: "Reviewing your return",
    description: "Our team is preparing and reviewing your return.",
    owner: "firm",
  },
  {
    phase: "needs-your-answer",
    label: "Needs your answer",
    description: "We have a question that needs your input before we can continue.",
    owner: "client",
  },
  {
    phase: "ready-to-sign",
    label: "Ready to sign",
    description: "Your return is complete and ready for your signature.",
    owner: "client",
  },
  {
    phase: "filed",
    label: "Filed",
    description: "Your return has been filed.",
    owner: "firm",
  },
]

/** Order matches the StaffState union in src/types/return.ts. Four internal review states
 * (extraction-review, preparation, manager-review, partner-review) all collapse to the
 * single "Reviewing your return" client phase — that collapse is the point: it's the
 * complexity clients are never meant to see. */
export const STAFF_STATES: StaffStateInfo[] = [
  { state: "intake", label: "Intake", owner: "firm", clientPhase: "gathering-documents" },
  {
    state: "docs-pending",
    label: "Documents pending",
    owner: "client",
    clientPhase: "gathering-documents",
  },
  {
    state: "extraction-review",
    label: "Extraction review",
    owner: "firm",
    clientPhase: "reviewing",
  },
  { state: "preparation", label: "Preparation", owner: "firm", clientPhase: "reviewing" },
  { state: "open-items", label: "Open items", owner: "client", clientPhase: "needs-your-answer" },
  { state: "manager-review", label: "Manager review", owner: "firm", clientPhase: "reviewing" },
  { state: "partner-review", label: "Partner review", owner: "firm", clientPhase: "reviewing" },
  {
    state: "client-signature",
    label: "Client signature",
    owner: "client",
    clientPhase: "ready-to-sign",
  },
  { state: "e-filed", label: "E-filed", owner: "firm", clientPhase: "filed" },
]

/** The many-to-one mapping table, standalone so it can be rendered as a UI table without
 * every consumer re-deriving it from STAFF_STATES. */
export const STATE_TO_PHASE: Record<StaffState, ClientPhase> = Object.fromEntries(
  STAFF_STATES.map((s) => [s.state, s.clientPhase])
) as Record<StaffState, ClientPhase>

export function getClientPhaseForState(state: StaffState): ClientPhase {
  return STATE_TO_PHASE[state]
}

export function getOwner(state: StaffState): "client" | "firm" {
  return STAFF_STATES.find((s) => s.state === state)!.owner
}

/** What must happen for each StaffState to advance, absent any blocker. Doubles as the
 * "hover to see what must happen to advance" copy for StaffStateChip. */
const STATE_NEXT_ACTION: Record<StaffState, NextAction> = {
  intake: { description: "We're setting up your return and requesting your documents.", owner: "firm" },
  "docs-pending": { description: "Upload your remaining tax documents.", owner: "client" },
  "extraction-review": {
    description: "We're reviewing the data pulled from your documents.",
    owner: "firm",
  },
  preparation: { description: "We're preparing your return.", owner: "firm" },
  "open-items": { description: "Answer the open items on your return.", owner: "client" },
  "manager-review": { description: "A manager is reviewing your return.", owner: "firm" },
  "partner-review": { description: "A partner is giving final review before filing.", owner: "firm" },
  "client-signature": { description: "Review and sign your completed return.", owner: "client" },
  "e-filed": { description: "Your return has been filed — nothing further is needed.", owner: "firm" },
}

/** Blockers are a property of the return, never a status value — see Blocker in
 * src/types/return.ts. Sorted oldest first: the earliest-raised blocker is the one that's
 * been waiting longest. */
export function getBlockers(ret: Return): Blocker[] {
  return [...ret.blockers].sort((a, b) => a.since.localeCompare(b.since))
}

/**
 * What must happen next and who owns it. A blocker (if any) always wins over the state's
 * default next action — a return can be mid-Preparation and still be stuck on a blocker.
 * The description here is deliberately generic ("waiting on you/us") rather than the
 * blocker's internal reason, so it's safe to show to clients as-is.
 */
export function getNextAction(ret: Return): NextAction {
  const blockers = getBlockers(ret)
  if (blockers.length > 0) {
    const owner = blockers[0].owner
    return {
      owner,
      description:
        owner === "client"
          ? "Waiting on you to resolve an open item before this can move forward."
          : "Waiting on our team to resolve an item before this can move forward.",
    }
  }
  return STATE_NEXT_ACTION[ret.staffState]
}
