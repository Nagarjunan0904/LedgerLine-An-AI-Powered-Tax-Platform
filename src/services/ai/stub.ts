import type { ExtractedField } from "@/types"
import {
  getDocument,
  getDocumentsForReturn,
  getExtractedField,
  getExtractedFieldsForDocument,
  getField,
} from "@/data/fixtures"
import { collectExtractedSources, LOW_CONFIDENCE_THRESHOLD, traceField } from "@/lib/provenance"
import type { FieldNode, SourceNode, TransformStepDetail } from "@/lib/provenance"
import { documentPayerName, parseBoxLabel } from "@/lib/labels"
import { AIServiceError } from "./types"
import type { Conflict, EvidenceRef, Explanation, ExtractionResult, Suggestion } from "./types"

/**
 * Fixture-backed stand-in for a real model integration. Every response is derived from actual
 * ExtractedField/ReturnField/Document data — confidence, source count, document type — never
 * a generic string, so two different low-confidence fields read as two different situations,
 * not the same placeholder twice.
 */

// ---------------------------------------------------------------------------
// Simulated network — genuinely random, on purpose. generate.ts's seeded determinism exists
// so the DEMO DATA is reproducible; this randomness exists so the demo's ERROR PATH is real
// and can show up organically in a live run, which is the whole point of simulating it.
// ---------------------------------------------------------------------------

const MIN_LATENCY_MS = 300
const MAX_LATENCY_MS = 900
const FAILURE_RATE = 1 / 20

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function simulateNetwork(action: string): Promise<void> {
  await wait(MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS))
  if (Math.random() < FAILURE_RATE) {
    throw new AIServiceError(`The AI service failed while trying to ${action}. Try again.`)
  }
}

// ---------------------------------------------------------------------------
// Small deterministic helpers — the same field must explain itself the same way every time,
// even though the network simulation above is randomized.
// ---------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function parseMoneyValue(raw: string): number | null {
  const match = /^-?\$[\d,]+(\.\d+)?$/.exec(raw.trim())
  if (!match) return null
  const negative = raw.trim().startsWith("-")
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""))
  return negative ? -n : n
}

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function recommendedActionFor(confidence: number): Explanation["recommendedAction"] {
  if (confidence >= 0.95) return "accept"
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "review"
  return "needs-human"
}

/** Curated, plausible OCR-failure reasons — picked deterministically per extraction so the
 * same field always tells the same story. Checked against the raw value first: when the
 * fixture data itself says why (a handwritten or blurry source), that's more specific and
 * honest than picking from the list. */
function uncertaintyReasonFor(extracted: ExtractedField): string {
  const raw = extracted.rawValue.toLowerCase()
  if (raw.includes("illegible") || raw.includes("handwritten")) {
    return "The source figure is handwritten, and part of it is illegible on the scan."
  }
  if (raw.includes("blurry") || raw.includes("blurred")) {
    return "The scan is blurry in this region, so the digits couldn't be fully confirmed."
  }
  const reasons = [
    "Faint scan in the box region made the digits hard to confirm.",
    "The number sits close to a fold line, which softened a couple of digits.",
    "Ink bleed-through from the reverse side made two digits ambiguous.",
    "The box border overlaps the printed value slightly, confusing where it starts.",
    "A staple mark partially obscures one digit in this box.",
  ]
  return reasons[hashString(extracted.id) % reasons.length]
}

/** A plausible near-miss reading, derived from the actual value rather than invented — the
 * kind of alternative a real OCR pass would have scored just behind the winning read. */
function alternativesConsideredFor(
  extracted: ExtractedField
): { value: string; confidence: number }[] | undefined {
  const amount = parseMoneyValue(extracted.rawValue)
  if (amount === null) return undefined
  const seed = hashString(extracted.id)
  const direction = seed % 2 === 0 ? 1 : -1
  const magnitude = (1 + (seed % 5)) * 100
  const alternative = amount + direction * magnitude
  return [
    {
      value: formatMoney(alternative),
      confidence: Math.round(extracted.confidence * 0.6 * 100) / 100,
    },
  ]
}

function describeSource(source: SourceNode): string {
  if (source.kind === "extracted") {
    const payer = documentPayerName(source.document) ?? source.document.fileName
    return `${payer} (${Math.round(source.extracted.confidence * 100)}% confidence)`
  }
  if (source.kind === "field") return source.chain.field.label
  return source.description
}

function describeStep(detail: TransformStepDetail): string {
  const { step, sources } = detail
  switch (step.op) {
    case "direct": {
      const source = sources[0]
      return source ? `This value was copied directly from ${describeSource(source)}.` : "This value was copied directly from its source."
    }
    case "sum":
      return `This value is the sum of ${sources.length} sources: ${sources.map(describeSource).join(", ")}.`
    case "subtract":
      return `This value is the difference of ${sources.length} sources: ${sources.map(describeSource).join(", ")}.`
    case "multiply":
      return `This value was scaled by a factor of ${step.factor} from ${sources[0] ? describeSource(sources[0]) : "its source"}.`
    case "lookup":
      return `This value was looked up from ${step.table} using key ${step.key}.`
    case "manual-entry":
      return `This value was entered manually — ${step.reason}`
  }
}

function summarizeFieldNode(node: FieldNode): string {
  if (node.steps.length === 0) return `No provenance is recorded for ${node.field.label}.`
  return node.steps.map(describeStep).join(" ")
}

function evidenceLabel(source: Extract<SourceNode, { kind: "extracted" }>): string {
  const box = parseBoxLabel(source.extracted.label)
  const payer = documentPayerName(source.document) ?? source.document.fileName
  return `${box.description || source.extracted.label} on ${payer}`
}

/** Explains one specific raw extraction — its own confidence, its own reasons for doubt.
 * This is what makes Corvid (0.71) read as a genuinely different situation from Acme (0.98)
 * on the same field: they're two different calls into this function, not one template. */
function explainExtractedField(extracted: ExtractedField): Explanation {
  const document = getDocument(extracted.documentId)
  const box = parseBoxLabel(extracted.label)
  const payer = document ? (documentPayerName(document) ?? document.fileName) : "an unknown document"
  const lowConfidence = extracted.confidence < LOW_CONFIDENCE_THRESHOLD
  const description = box.description || extracted.label

  const summary = lowConfidence
    ? `We read ${extracted.rawValue} for ${description} on ${payer}, but we're not fully confident in it.`
    : `We read ${extracted.rawValue} for ${description} on ${payer}, and we're confident it's correct.`

  return {
    summary,
    evidence: [{ extractedFieldId: extracted.id, label: `${description} on ${payer}` }],
    confidence: extracted.confidence,
    uncertaintyReason: lowConfidence ? uncertaintyReasonFor(extracted) : undefined,
    recommendedAction: recommendedActionFor(extracted.confidence),
    alternativesConsidered: lowConfidence ? alternativesConsideredFor(extracted) : undefined,
  }
}

/** Explains a composed return field — the sum/direct/lookup/manual-entry story traceField
 * already builds structurally, rendered as one plain sentence per step. */
function explainReturnField(node: FieldNode): Explanation {
  const extractedSources = collectExtractedSources(node)
  const evidence: EvidenceRef[] = extractedSources.map((source) => ({
    extractedFieldId: source.extracted.id,
    label: evidenceLabel(source),
  }))

  const confidence = node.provenance?.confidence ?? 1
  const flaggedSource = extractedSources.find((source) => source.lowConfidence)
  const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD

  return {
    summary: summarizeFieldNode(node),
    evidence,
    confidence,
    uncertaintyReason: flaggedSource
      ? uncertaintyReasonFor(flaggedSource.extracted)
      : lowConfidence
        ? "The combined confidence is low even though no single source was flagged on its own."
        : undefined,
    recommendedAction: recommendedActionFor(confidence),
    alternativesConsidered: flaggedSource ? alternativesConsideredFor(flaggedSource.extracted) : undefined,
  }
}

// ---------------------------------------------------------------------------
// AIService implementation
// ---------------------------------------------------------------------------

export async function extractFields(documentId: string): Promise<ExtractionResult> {
  await simulateNetwork("extract fields from this document")
  const document = getDocument(documentId)
  if (!document) throw new AIServiceError(`No document found for id "${documentId}".`)
  return {
    documentId,
    status: document.extractionStatus,
    fields: getExtractedFieldsForDocument(documentId),
  }
}

/** Accepts either a ReturnField id (explain the composed value) or an ExtractedField id
 * (explain one raw extraction) — see AIService's doc comment for why both are meaningful. */
export async function explainField(fieldId: string): Promise<Explanation> {
  await simulateNetwork("explain this field")

  const returnField = getField(fieldId)
  if (returnField) {
    const node = traceField(fieldId)
    if (!node) throw new AIServiceError(`No provenance found for field "${fieldId}".`)
    return explainReturnField(node)
  }

  const extracted = getExtractedField(fieldId)
  if (extracted) return explainExtractedField(extracted)

  throw new AIServiceError(`No field or extraction found for id "${fieldId}".`)
}

export async function suggestCorrection(fieldId: string, userValue: string): Promise<Suggestion> {
  await simulateNetwork("evaluate this correction")

  const field = getField(fieldId)
  if (!field) throw new AIServiceError(`No field found for id "${fieldId}".`)

  const originalValue = String(field.value)
  const trimmed = userValue.trim()

  if (typeof field.value !== "number") {
    return trimmed === originalValue
      ? { fieldId, originalValue, suggestedValue: trimmed, confidence: 1, rationale: "No change from the current value." }
      : {
          fieldId,
          originalValue,
          suggestedValue: trimmed,
          confidence: 0.7,
          rationale: "This is a text field, so we can't verify the new value automatically — a person should confirm it.",
        }
  }

  // Strip formatting characters only ($, commas, whitespace) — not every non-digit — so
  // genuinely non-numeric input like "not a number" parses to NaN instead of silently
  // becoming Number("") === 0, which would misreport a junk value as "a large change to 0."
  const cleaned = trimmed.replace(/[$,\s]/g, "")
  const parsed = Number(cleaned)
  if (cleaned === "" || Number.isNaN(parsed)) {
    return {
      fieldId,
      originalValue,
      suggestedValue: trimmed,
      confidence: 0.2,
      rationale: `"${trimmed}" doesn't look like a number, and this field expects one. Double-check the format before saving.`,
    }
  }

  const delta = Math.abs(parsed - field.value)
  const relativeDelta = field.value !== 0 ? delta / Math.abs(field.value) : delta > 0 ? 1 : 0

  if (relativeDelta < 0.02) {
    return {
      fieldId,
      originalValue,
      suggestedValue: trimmed,
      confidence: 0.92,
      rationale: "Close to the extracted value — likely a minor correction, safe to accept.",
    }
  }
  if (relativeDelta < 0.25) {
    return {
      fieldId,
      originalValue,
      suggestedValue: trimmed,
      confidence: 0.65,
      rationale: `This differs from the extracted value by about ${Math.round(relativeDelta * 100)}% — plausible, but worth a second look.`,
    }
  }
  return {
    fieldId,
    originalValue,
    suggestedValue: trimmed,
    confidence: 0.3,
    rationale: `This is a large change from the extracted value (${originalValue} → ${trimmed}) — confirm this wasn't a typo before saving.`,
  }
}

/**
 * Groups every extraction on the return by (payer, document type, box label) and flags any
 * group that disagrees on the value — a general heuristic, not a check for one hardcoded
 * case, that happens to catch the seeded conflict: two 1099-INTs from Regional Community Bank
 * reporting different interest amounts for the same box.
 */
export async function detectConflicts(returnId: string): Promise<Conflict[]> {
  await simulateNetwork("check this return for conflicts")

  const groups = new Map<string, { extracted: ExtractedField; payer: string; type: string; label: string }[]>()
  for (const document of getDocumentsForReturn(returnId)) {
    const payer = documentPayerName(document)
    if (!payer) continue
    for (const extracted of getExtractedFieldsForDocument(document.id)) {
      const key = `${payer}|${document.type}|${extracted.label}`
      const list = groups.get(key) ?? []
      list.push({ extracted, payer, type: document.type, label: extracted.label })
      groups.set(key, list)
    }
  }

  const conflicts: Conflict[] = []
  for (const entries of groups.values()) {
    if (entries.length < 2) continue
    const distinctValues = new Set(entries.map((entry) => entry.extracted.rawValue))
    if (distinctValues.size < 2) continue

    const { payer, type, label } = entries[0]
    const box = parseBoxLabel(label)
    conflicts.push({
      id: `conflict-${entries.map((entry) => entry.extracted.id).join("-")}`,
      returnId,
      summary: `${entries.length} ${type} forms from ${payer} report different amounts for ${box.description || label}: ${entries
        .map((entry) => entry.extracted.rawValue)
        .join(" vs. ")}.`,
      evidence: entries.map((entry) => ({
        extractedFieldId: entry.extracted.id,
        label: `${box.description || label} on ${payer}`,
      })),
      severity: "high",
    })
  }
  return conflicts
}
