import * as stub from "./stub"
import type { AIService } from "./types"

/**
 * SWAP POINT: the entire AI layer today is this fixture-backed stub. Every consumer imports
 * `aiService` from here — never `./stub` directly — so replacing it with a real model
 * integration later is a one-file change: implement AIService (see ./types) and swap the
 * object below. Nothing outside this directory should need to change.
 */
export const aiService: AIService = {
  extractFields: stub.extractFields,
  explainField: stub.explainField,
  suggestCorrection: stub.suggestCorrection,
  detectConflicts: stub.detectConflicts,
}

export { AIServiceError } from "./types"
export type { AIService, Conflict, EvidenceRef, Explanation, ExtractionResult, Suggestion } from "./types"
