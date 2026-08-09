import type { Document, ExtractedField, FieldState, Provenance, ReturnField, TransformStep } from "@/types"
import { getDocument, getExtractedField, getField, getFieldsForReturn, getProvenance } from "@/data/fixtures"
import type { Correction } from "@/stores/useCorrectionsStore"

/**
 * Below this, a source is flagged in the chain itself — not something a reviewer has to click
 * into to discover. Matches generate.ts's own target: ~15% of extractions fall below 0.80.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.8

export interface ExtractedSource {
  kind: "extracted"
  extracted: ExtractedField
  document: Document
  lowConfidence: boolean
  /** Non-null once applyCorrections has merged a human correction over this source — the
   * extracted.rawValue above already reflects it, this is what lets a consumer render the
   * override marker and the original value on hover without re-deriving anything. */
  correction: Correction | null
}

/** A field derived from another field's own value, not from a raw extraction — the
 * derived-from-derived case. Carries that field's full chain so it renders recursively. */
export interface FieldSource {
  kind: "field"
  chain: FieldNode
}

/** A transform step with no document or field behind it at all: a lookup table, or a value a
 * person typed in directly. */
export interface ExternalSource {
  kind: "external"
  description: string
}

export type SourceNode = ExtractedSource | FieldSource | ExternalSource

export interface TransformStepDetail {
  step: TransformStep
  /** This step's own sources, in the order its sourceId(s) list them. Empty for lookup and
   * manual-entry — those steps don't reference anything to resolve. */
  sources: SourceNode[]
}

export interface FieldNode {
  field: ReturnField
  provenance: Provenance | null
  steps: TransformStepDetail[]
  /** Every source across every step, flattened — for a consumer that just wants the full list
   * of clickable rows without caring which step each belongs to. */
  sources: SourceNode[]
  /** Non-null when Provenance.sourceFieldIds disagrees with what the transform steps
   * themselves actually reference. The transform is the ground truth here — the reason this
   * exists is to catch the sourceFieldIds list drifting out of sync with it, not the other
   * way around. */
  sourceDisagreement: string | null
}

/** The DOM id a clickable chain row uses — deliberately different from the extracted field's
 * own id (that one belongs to HighlightOverlay; ConnectorOverlay draws between the two). */
export function chainRowId(extractedId: string): string {
  return `provenance-source-${extractedId}`
}

function stepSourceIds(step: TransformStep): string[] {
  switch (step.op) {
    case "direct":
      return [step.sourceId]
    case "sum":
    case "subtract":
      return step.sourceIds
    case "multiply":
      return [step.sourceId]
    case "lookup":
    case "manual-entry":
      return []
  }
}

function externalDescription(step: TransformStep): string | null {
  switch (step.op) {
    case "lookup":
      return `Looked up from ${step.table} (key ${step.key})`
    case "manual-entry":
      return `Entered manually — ${step.reason}`
    default:
      return null
  }
}

/** Declared (Provenance.sourceFieldIds) vs. derived (walking the transform steps) — null when
 * they agree, otherwise a plain-language note of exactly where they diverge. */
function diffSourceIds(declared: string[], derived: string[]): string | null {
  const declaredSet = new Set(declared)
  const derivedSet = new Set(derived)
  const onlyDeclared = declared.filter((id) => !derivedSet.has(id))
  const onlyDerived = derived.filter((id) => !declaredSet.has(id))
  if (onlyDeclared.length === 0 && onlyDerived.length === 0) return null
  const parts: string[] = []
  if (onlyDeclared.length > 0) {
    parts.push(`sourceFieldIds lists ${onlyDeclared.join(", ")}, which no transform step references`)
  }
  if (onlyDerived.length > 0) {
    parts.push(`the transform references ${onlyDerived.join(", ")}, which sourceFieldIds doesn't list`)
  }
  return parts.join("; ")
}

/** Resolves one sourceId to whatever it actually is: a raw extraction (leaf), another return
 * field (branch — recurse), or neither (a dangling reference, reported rather than thrown). */
function resolveSource(id: string, visited: Set<string>): SourceNode {
  const extracted = getExtractedField(id)
  if (extracted) {
    const document = getDocument(extracted.documentId)
    if (!document) {
      return { kind: "external", description: `Extracted field ${id} references a missing document.` }
    }
    return {
      kind: "extracted",
      extracted,
      document,
      lowConfidence: extracted.confidence < LOW_CONFIDENCE_THRESHOLD,
      correction: null,
    }
  }

  const nestedField = getField(id)
  if (nestedField) {
    const chain = traceFieldInternal(id, visited)
    if (chain) return { kind: "field", chain }
  }

  return { kind: "external", description: `Unresolved source ${id}.` }
}

function traceFieldInternal(fieldId: string, visited: Set<string>): FieldNode | null {
  const field = getField(fieldId)
  if (!field) return null

  if (visited.has(fieldId)) {
    return {
      field,
      provenance: null,
      steps: [],
      sources: [],
      sourceDisagreement: `Circular provenance: ${fieldId} traces back to itself.`,
    }
  }
  const nextVisited = new Set(visited)
  nextVisited.add(fieldId)

  const provenance = getProvenance(fieldId)
  if (!provenance) {
    return { field, provenance: null, steps: [], sources: [], sourceDisagreement: null }
  }

  const steps: TransformStepDetail[] = provenance.transform.map((step) => {
    const externalNote = externalDescription(step)
    if (externalNote) {
      return { step, sources: [{ kind: "external", description: externalNote }] }
    }
    const sources = stepSourceIds(step).map((id) => resolveSource(id, nextVisited))
    return { step, sources }
  })

  const derivedIds = provenance.transform.flatMap(stepSourceIds)

  return {
    field,
    provenance,
    steps,
    sources: steps.flatMap((s) => s.sources),
    sourceDisagreement: diffSourceIds(provenance.sourceFieldIds, derivedIds),
  }
}

/**
 * Target field → transform steps → source extracted fields → their documents and page
 * regions, recursively through any field that's itself derived from another field. Sources
 * are read off the transform steps, not Provenance.sourceFieldIds — see diffSourceIds for why.
 */
export function traceField(fieldId: string): FieldNode | null {
  return traceFieldInternal(fieldId, new Set())
}

/** Every extracted source in a chain, including ones nested inside a derived-from-derived
 * field — the document pane needs the full set, not just this field's own top-level steps. */
export function collectExtractedSources(node: FieldNode): ExtractedSource[] {
  const result: ExtractedSource[] = []
  for (const source of node.sources) {
    if (source.kind === "extracted") {
      result.push(source)
    } else if (source.kind === "field") {
      result.push(...collectExtractedSources(source.chain))
    }
  }
  return result
}

/** Every ReturnField on this return whose provenance directly cites this extracted field as a
 * source — the reverse of traceField's own direction. A field-centric view walks from a field
 * down to its sources; a document-centric view (DocumentExplorer's expanded row) needs the
 * other way round: what does this extraction feed into. */
export function fieldsSourcedFrom(extractedId: string, returnId: string): ReturnField[] {
  return getFieldsForReturn(returnId).filter((f) => getProvenance(f.id)?.sourceFieldIds.includes(extractedId))
}

/** The distinct documents behind a chain, in first-seen order — one per document even when
 * multiple sources in the chain point at it (not the case today, but two boxes on the same
 * form both feeding the same field is plausible), so the document pane never renders the same
 * form twice. */
export function collectDocuments(node: FieldNode): Document[] {
  const seen = new Set<string>()
  const docs: Document[] = []
  for (const source of collectExtractedSources(node)) {
    if (!seen.has(source.document.id)) {
      seen.add(source.document.id)
      docs.push(source.document)
    }
  }
  return docs
}

// ---------------------------------------------------------------------------
// Correction resolution — the single place every consumer of an ExtractedField's or
// ReturnField's value goes through. A correction recorded in useCorrectionsStore always wins
// over the fixture's own value; this is what keeps the field, the chain, the equation, and the
// document renderer from ever disagreeing about what a corrected source is actually worth.
// ---------------------------------------------------------------------------

export type CorrectionsMap = Record<string, Correction>

export interface ResolvedExtractedValue {
  value: string
  isCorrected: boolean
  originalValue: string | null
  correction: Correction | null
}

export function resolveExtractedValue(extracted: ExtractedField, corrections: CorrectionsMap): ResolvedExtractedValue {
  const correction = corrections[extracted.id]
  if (!correction) {
    return { value: extracted.rawValue, isCorrected: false, originalValue: null, correction: null }
  }
  return {
    value: String(correction.newValue),
    isCorrected: true,
    originalValue: String(correction.previousValue),
    correction,
  }
}

function parseMoneyValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "")
  if (cleaned === "") return null
  const negative = cleaned.startsWith("-")
  const n = Number(cleaned.replace(/[^0-9.]/g, ""))
  if (Number.isNaN(n)) return null
  return negative ? -n : n
}

/** Recomputes a sum/subtract field from its sources' resolved values — only when at least one
 * source actually has a correction; otherwise there's nothing to recompute and the field's own
 * original value stands. Only walks extracted (leaf) sources: a derived-from-derived or
 * external source makes a confident recompute impossible, so it bails to null rather than
 * guess. */
function recomputeFromSources(node: FieldNode, corrections: CorrectionsMap): number | null {
  if (typeof node.field.value !== "number") return null

  let sawCorrection = false
  let total: number | null = null

  for (const detail of node.steps) {
    if (detail.step.op !== "sum" && detail.step.op !== "subtract") continue
    const values: number[] = []
    for (const source of detail.sources) {
      if (source.kind !== "extracted") return null
      const resolved = resolveExtractedValue(source.extracted, corrections)
      if (resolved.isCorrected) sawCorrection = true
      const numeric = parseMoneyValue(resolved.value)
      if (numeric === null) return null
      values.push(numeric)
    }
    if (values.length === 0) continue
    total = detail.step.op === "sum" ? values.reduce((a, b) => a + b, 0) : values.reduce((a, b, i) => (i === 0 ? b : a - b))
  }

  return sawCorrection && total !== null ? Math.round(total * 100) / 100 : null
}

export interface ResolvedFieldValue {
  value: number | string
  state: FieldState
  isCorrected: boolean
  /** True when this field's value changed not because IT was corrected, but because a source
   * it's derived from was — the ripple. */
  isRecalculated: boolean
  originalValue: number | string | null
  correction: Correction | null
}

/** A ReturnField's effective value: a direct correction on the field itself wins, then a
 * recompute from corrected sources, then the field's own original value. */
export function resolveFieldValue(node: FieldNode, corrections: CorrectionsMap): ResolvedFieldValue {
  const direct = corrections[node.field.id]
  if (direct) {
    return {
      value: direct.newValue,
      state: direct.newState ?? node.field.state,
      isCorrected: true,
      isRecalculated: false,
      originalValue: direct.previousValue,
      correction: direct,
    }
  }

  const recalculated = recomputeFromSources(node, corrections)
  if (recalculated !== null) {
    return {
      value: recalculated,
      state: node.field.state,
      isCorrected: false,
      isRecalculated: true,
      originalValue: null,
      correction: null,
    }
  }

  return {
    value: node.field.value,
    state: node.field.state,
    isCorrected: false,
    isRecalculated: false,
    originalValue: null,
    correction: null,
  }
}

function applyCorrectionsToSource(source: SourceNode, corrections: CorrectionsMap): SourceNode {
  if (source.kind === "extracted") {
    const resolved = resolveExtractedValue(source.extracted, corrections)
    return {
      ...source,
      extracted: resolved.isCorrected ? { ...source.extracted, rawValue: resolved.value } : source.extracted,
      correction: resolved.correction,
    }
  }
  if (source.kind === "field") {
    return { kind: "field", chain: applyCorrections(source.chain, corrections) }
  }
  return source
}

/**
 * Returns a FieldNode-shaped clone of `node` with every correction merged in: each corrected
 * extracted source's rawValue is swapped for its corrected value (and flagged via `correction`
 * on the ExtractedSource), and the field's own value is recomputed to match. Every consumer
 * that renders a chain — ProvenanceChain, TransformSteps's equation — reads through this
 * instead of the raw traceField() result, so a correction can never show through in one place
 * and not another.
 */
export function applyCorrections(node: FieldNode, corrections: CorrectionsMap): FieldNode {
  const steps: TransformStepDetail[] = node.steps.map((detail) => ({
    step: detail.step,
    sources: detail.sources.map((source) => applyCorrectionsToSource(source, corrections)),
  }))
  const resolution = resolveFieldValue(node, corrections)
  return {
    ...node,
    field: { ...node.field, value: resolution.value, state: resolution.state },
    steps,
    sources: steps.flatMap((s) => s.sources),
  }
}
