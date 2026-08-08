import { useMemo } from "react"

import type { ExtractedField, ReturnField } from "@/types"
import {
  resolveExtractedValue,
  resolveFieldValue,
  traceField,
  type ResolvedExtractedValue,
  type ResolvedFieldValue,
} from "@/lib/provenance"
import { useRoleStore } from "@/stores/useRoleStore"
import { useCorrectionsStore } from "@/stores/useCorrectionsStore"

/**
 * The correction-flow logic, separate from CorrectionFlow.tsx's component so that file can
 * export only the component (react-refresh/only-export-components) — hooks and pure helpers
 * live here instead, co-located with the components that use them rather than promoted to
 * src/lib (documented there as React-free pure logic; useMemo/Zustand hooks don't belong).
 *
 * The actual merge-a-correction-over-a-fixture-value logic lives in src/lib/provenance.ts
 * (resolveExtractedValue / resolveFieldValue) — the same resolver ProvenanceChain,
 * TransformSteps, and MockFormRenderer read through, so this file only wraps it in hooks.
 */

/** DOM id for an evidence chip in ExplainDrawer — deliberately distinct from provenance.ts's
 * chainRowId, since both can be mounted at once (the chain in ReturnReview's center pane,
 * evidence in the drawer) and must never collide. ReturnReview picks whichever one is
 * currently the connector's real anchor. */
export function explainEvidenceId(extractedFieldId: string): string {
  return `explain-evidence-${extractedFieldId}`
}

function parseMoneyValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "")
  if (cleaned === "") return null
  const negative = cleaned.startsWith("-")
  const n = Number(cleaned.replace(/[^0-9.]/g, ""))
  if (Number.isNaN(n)) return null
  return negative ? -n : n
}

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type EffectiveField = ResolvedFieldValue
export type EffectiveExtracted = ResolvedExtractedValue

/** The fixture's own field merged with whatever's been corrected — recomputed from a raw
 * store slice each time, never derived inside the selector itself. Resolution itself is
 * resolveFieldValue (src/lib/provenance.ts), the same resolver the chain and document renderer
 * read through. */
export function useEffectiveField(field: ReturnField): EffectiveField {
  const corrections = useCorrectionsStore((s) => s.corrections)
  return useMemo(() => {
    const node = traceField(field.id)
    if (!node) {
      return {
        value: field.value,
        state: field.state,
        isCorrected: false,
        isRecalculated: false,
        originalValue: null,
        correction: null,
      }
    }
    return resolveFieldValue(node, corrections)
  }, [field, corrections])
}

export function useEffectiveExtracted(extracted: ExtractedField): EffectiveExtracted {
  const corrections = useCorrectionsStore((s) => s.corrections)
  return useMemo(() => resolveExtractedValue(extracted, corrections), [extracted, corrections])
}

/** Corrects a raw extraction — a "W-2 source" — used from ExplainDrawer's evidence list.
 * ExtractedFields have no FieldState, so previousState/newState are both null; the value is
 * re-formatted through the same money convention rawValue already uses, so a corrected
 * source is indistinguishable in shape from an original one. */
export function useCorrectExtracted() {
  const userId = useRoleStore((s) => s.userId)
  const correctField = useCorrectionsStore((s) => s.correctField)
  return function correctExtracted(extracted: ExtractedField, raw: string, currentValue: string) {
    const parsed = parseMoneyValue(raw)
    if (parsed === null) return
    correctField(extracted.id, {
      by: userId,
      previousValue: currentValue,
      newValue: formatMoney(parsed),
      previousState: null,
      newState: null,
    })
  }
}
