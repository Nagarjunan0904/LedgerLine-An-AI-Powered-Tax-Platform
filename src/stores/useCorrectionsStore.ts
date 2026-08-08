import { create } from "zustand"

import type { FieldState } from "@/types"

/**
 * Mirrors AuditEntry's own shape (id, fieldId, at, by, previousValue, newValue,
 * previousState, newState) — same fields, same names — except previousState/newState are
 * nullable here: a corrected ExtractedField (a "W-2 source," not a ReturnField) has no
 * FieldState at all, and forcing one onto it would be dishonest rather than consistent.
 */
export interface Correction {
  id: string
  fieldId: string
  /** ISO 8601 timestamp */
  at: string
  /** UserRef */
  by: string
  previousValue: number | string
  newValue: number | string
  previousState: FieldState | null
  newState: FieldState | null
  /** The "why was this wrong" training signal, once given — null until the prompt is
   * answered. */
  reason: string | null
  /** True once the reason prompt has been answered OR explicitly dismissed. Either way, stop
   * showing it — "quiet, dismissible" means it doesn't nag. */
  reasonPromptDismissed: boolean
}

export interface CorrectFieldInput {
  by: string
  previousValue: number | string
  newValue: number | string
  previousState: FieldState | null
  newState: FieldState | null
}

interface CorrectionsState {
  /** Keyed by whatever was corrected — a ReturnField id or an ExtractedField id. Both are
   * globally-unique strings in this fixture set, so one flat map is safe. */
  corrections: Record<string, Correction>
  correctField: (fieldId: string, input: CorrectFieldInput) => void
  setReason: (fieldId: string, reason: string) => void
  dismissReasonPrompt: (fieldId: string) => void
}

let nextCorrectionId = 1

/**
 * In-memory only, resets on reload — same intentional tradeoff as every other mutation store
 * in this prototype (see CLAUDE.md). The fixture data is never touched; every screen that
 * shows a "live" value merges this store's corrections over it at render time.
 */
export const useCorrectionsStore = create<CorrectionsState>((set) => ({
  corrections: {},
  correctField: (fieldId, input) =>
    set((state) => {
      const existing = state.corrections[fieldId]
      // The original is captured once, on the FIRST correction, and never overwritten by a
      // later re-edit — otherwise a second correction would silently destroy the true
      // original, which is exactly what "never destroy the original" forbids.
      const previousValue = existing ? existing.previousValue : input.previousValue
      const previousState = existing ? existing.previousState : input.previousState
      return {
        corrections: {
          ...state.corrections,
          [fieldId]: {
            id: `correction-${nextCorrectionId++}`,
            fieldId,
            at: new Date().toISOString(),
            by: input.by,
            previousValue,
            previousState,
            newValue: input.newValue,
            newState: input.newState,
            reason: null,
            reasonPromptDismissed: false,
          },
        },
      }
    }),
  setReason: (fieldId, reason) =>
    set((state) => {
      const existing = state.corrections[fieldId]
      if (!existing) return state
      return {
        corrections: { ...state.corrections, [fieldId]: { ...existing, reason, reasonPromptDismissed: true } },
      }
    }),
  dismissReasonPrompt: (fieldId) =>
    set((state) => {
      const existing = state.corrections[fieldId]
      if (!existing) return state
      return { corrections: { ...state.corrections, [fieldId]: { ...existing, reasonPromptDismissed: true } } }
    }),
}))
