import type { Document, ExtractedField, Provenance, ReturnField, TransformStep } from "@/types"
import { getDocument, getExtractedField, getField, getProvenance } from "@/data/fixtures"

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
