import type { ExtractedField, ExtractionStatus } from "@/types"

/**
 * The contract a real model integration implements — everything in this file is a type or an
 * error class. No fixture reads, no async logic, nothing that could accidentally couple a real
 * implementation to this project's demo data. See stub.ts for the fixture-backed version that
 * satisfies this contract today.
 */

/** Points at a real ExtractedField id — the same id HighlightOverlay uses as its DOM id and
 * ConnectorOverlay measures against (see components/documents/HighlightOverlay.tsx and
 * components/provenance/ConnectorOverlay.tsx). An explain drawer can highlight the exact
 * document region for a piece of evidence without a second coordinate system or a lookup
 * table — it's the same id, everywhere. */
export interface EvidenceRef {
  extractedFieldId: string
  /** Plain-language pointer for display next to the highlight, e.g. "Box 1 on the Acme Corp
   * W-2" — not just the raw id. */
  label: string
}

export interface ExtractionResult {
  documentId: string
  status: ExtractionStatus
  fields: ExtractedField[]
}

/**
 * This shape is the design decision that matters: it's what makes an AI-suggested value
 * something a person can actually evaluate instead of a number they either trust blindly or
 * reject blindly. `summary` and `uncertaintyReason` must read as sentences about THIS specific
 * value, not template text — "confidence is low" tells a reviewer nothing they can act on.
 */
export interface Explanation {
  /** One plain sentence: what determined this value, in the reader's terms. */
  summary: string
  evidence: EvidenceRef[]
  /** 0–1 */
  confidence: number
  /** Only present when there's a real reason for doubt — specific to what actually went
   * wrong reading this value ("faint scan in the box region"), never the tautology "low
   * confidence" restated as a reason. */
  uncertaintyReason?: string
  recommendedAction: "accept" | "review" | "needs-human"
  /** Other readings a real model considered and rejected, each with its own (lower)
   * confidence — present only when there genuinely were alternatives worth naming. */
  alternativesConsidered?: { value: string; confidence: number }[]
}

export interface Suggestion {
  fieldId: string
  originalValue: string
  suggestedValue: string
  /** How much the service trusts the PROPOSED value, not the original. */
  confidence: number
  rationale: string
}

export interface Conflict {
  id: string
  returnId: string
  summary: string
  evidence: EvidenceRef[]
  severity: "low" | "medium" | "high"
}

/**
 * Every method a real model-backed service would implement. `fieldId` on explainField
 * deliberately accepts either a ReturnField id (explain the composed value: "sum of 3
 * sources") or an ExtractedField id (explain one specific extraction's own confidence) — the
 * same duality EvidenceRef's extractedFieldId enables: evidence for a composed field can
 * itself be explained one level deeper.
 */
export interface AIService {
  extractFields(documentId: string): Promise<ExtractionResult>
  explainField(fieldId: string): Promise<Explanation>
  suggestCorrection(fieldId: string, userValue: string): Promise<Suggestion>
  detectConflicts(returnId: string): Promise<Conflict[]>
}

/** Thrown by any AIService method on simulated (or real) failure — callers catch this
 * specifically to distinguish "the AI call failed" from a programming error. */
export class AIServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AIServiceError"
  }
}
