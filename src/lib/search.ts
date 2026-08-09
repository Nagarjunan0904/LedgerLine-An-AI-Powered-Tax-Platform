import Fuse, { type IFuseOptions } from "fuse.js"
import { format } from "date-fns"

import type { Document, DocumentType, ExtractionStatus } from "@/types"
import { getExtractedFieldsForDocument, getOpenItems } from "@/data/fixtures"
import { documentPayerName } from "@/lib/labels"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/provenance"

/**
 * Canonical order for anything that lists document types — matches how a preparer scans a
 * return (income documents first, receipts and everything else last), not alphabetical.
 */
export const DOCUMENT_TYPES: DocumentType[] = [
  "W-2",
  "1099-INT",
  "1099-DIV",
  "1099-B",
  "K-1",
  "1098",
  "receipt",
  "other",
]

/** Most-needs-attention first — failed and pending extractions are the ones a preparer has to
 * do something about; complete ones are just there. */
export const EXTRACTION_STATUSES: ExtractionStatus[] = ["failed", "pending", "partial", "complete"]

export const EXTRACTION_STATUS_LABEL: Record<ExtractionStatus, string> = {
  failed: "Failed",
  pending: "Pending",
  partial: "Partial",
  complete: "Complete",
}

export type ConfidenceBand = "high" | "medium" | "low" | "none"

export const CONFIDENCE_BANDS: ConfidenceBand[] = ["low", "medium", "high", "none"]

/** Matches ConfidenceBadge's own three bands (src/components/ai/ConfidenceBadge.tsx), plus a
 * fourth for documents with no extraction to have a confidence about at all. */
export const CONFIDENCE_BAND_LABEL: Record<ConfidenceBand, string> = {
  high: "High confidence",
  medium: "Worth checking",
  low: "Needs your eyes",
  none: "No extraction",
}

export function bandForConfidence(confidence: number | null): ConfidenceBand {
  if (confidence === null) return "none"
  if (confidence >= 0.95) return "high"
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "medium"
  return "low"
}

/**
 * One document's worth of everything the explorer needs to search, filter, and group by,
 * computed once per document rather than re-derived by every consumer. A document's
 * confidence is its one extracted field's confidence — every seeded document has at most one
 * (see generate.ts) — null when extraction never produced one at all.
 */
export interface DocumentSearchRecord {
  document: Document
  payerName: string | null
  extractedValues: string[]
  confidence: number | null
  confidenceBand: ConfidenceBand
  hasOpenQuestions: boolean
}

export function buildSearchRecords(documents: Document[]): DocumentSearchRecord[] {
  const openDocIds = new Set<string>()
  for (const item of getOpenItems()) {
    if (item.resolvedAt !== null) continue
    for (const ref of item.linkedObjects) {
      if (ref.type === "document") openDocIds.add(ref.id)
    }
  }

  return documents.map((document) => {
    const extracted = getExtractedFieldsForDocument(document.id)
    const confidence = extracted.length > 0 ? extracted[0].confidence : null
    return {
      document,
      payerName: documentPayerName(document),
      extractedValues: extracted.map((e) => e.rawValue),
      confidence,
      confidenceBand: bandForConfidence(confidence),
      hasOpenQuestions: openDocIds.has(document.id),
    }
  })
}

// ---------------------------------------------------------------------------
// Search — fuzzy across filename, type, payer name, and extracted values, so "ten99" and
// "Acme Corp" both work. The Fuse index is built once per document set (see
// createDocumentSearchIndex); re-searching on every keystroke is cheap, re-indexing isn't.
// ---------------------------------------------------------------------------

interface FuseableRecord {
  id: string
  fileName: string
  type: string
  payerName: string
  extractedValues: string
}

/** How people actually say these out loud ("ten-ninety-nine", not "one-oh-nine-nine") —
 * character-level fuzzy matching alone won't bridge "ten99" to "1099-INT", since the two
 * strings aren't actually close in edit distance despite sounding the same. Folded into the
 * indexed `type` text as extra tokens rather than handled as a special case in the query, so
 * ordinary fuzzy matching still does the rest of the work. */
const TYPE_ALIASES: Partial<Record<DocumentType, string[]>> = {
  "1099-INT": ["ten99", "ten 99", "1099"],
  "1099-DIV": ["ten99", "ten 99", "1099"],
  "1099-B": ["ten99", "ten 99", "1099"],
  "1098": ["ten98", "ten 98"],
  "W-2": ["w2"],
  "K-1": ["k1"],
}

function toFuseable(record: DocumentSearchRecord): FuseableRecord {
  const aliases = TYPE_ALIASES[record.document.type]
  return {
    id: record.document.id,
    fileName: record.document.fileName,
    type: aliases ? `${record.document.type} ${aliases.join(" ")}` : record.document.type,
    payerName: record.payerName ?? "",
    extractedValues: record.extractedValues.join(" "),
  }
}

const FUSE_OPTIONS: IFuseOptions<FuseableRecord> = {
  keys: [
    { name: "fileName", weight: 2 },
    { name: "payerName", weight: 1.5 },
    { name: "type", weight: 1 },
    { name: "extractedValues", weight: 0.5 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
}

export function createDocumentSearchIndex(records: DocumentSearchRecord[]): Fuse<FuseableRecord> {
  return new Fuse(records.map(toFuseable), FUSE_OPTIONS)
}

export function searchDocuments(
  index: Fuse<FuseableRecord>,
  records: DocumentSearchRecord[],
  query: string
): DocumentSearchRecord[] {
  if (!query.trim()) return records
  const byId = new Map(records.map((r) => [r.document.id, r]))
  return index
    .search(query)
    .map((result) => byId.get(result.item.id))
    .filter((r): r is DocumentSearchRecord => r !== undefined)
}

// ---------------------------------------------------------------------------
// Filters — compose by AND. Every dimension is a list; an empty list means "no restriction on
// this dimension" rather than "match nothing."
// ---------------------------------------------------------------------------

export interface DocumentFilters {
  types: DocumentType[]
  statuses: ExtractionStatus[]
  confidenceBands: ConfidenceBand[]
  hasOpenQuestions: boolean
  uploadedBy: string[]
}

export const EMPTY_FILTERS: DocumentFilters = {
  types: [],
  statuses: [],
  confidenceBands: [],
  hasOpenQuestions: false,
  uploadedBy: [],
}

export function hasActiveFilters(filters: DocumentFilters): boolean {
  return (
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.confidenceBands.length > 0 ||
    filters.hasOpenQuestions ||
    filters.uploadedBy.length > 0
  )
}

export function matchesFilters(record: DocumentSearchRecord, filters: DocumentFilters): boolean {
  if (filters.types.length > 0 && !filters.types.includes(record.document.type)) return false
  if (filters.statuses.length > 0 && !filters.statuses.includes(record.document.extractionStatus)) return false
  if (filters.confidenceBands.length > 0 && !filters.confidenceBands.includes(record.confidenceBand)) return false
  if (filters.hasOpenQuestions && !record.hasOpenQuestions) return false
  if (filters.uploadedBy.length > 0 && !filters.uploadedBy.includes(record.document.uploadedBy)) return false
  return true
}

// ---------------------------------------------------------------------------
// Grouping — flattened into a single ordered list of group headers + records so a virtualizer
// can iterate over one flat array instead of a nested structure.
// ---------------------------------------------------------------------------

export type GroupBy = "type" | "status" | "upload-date"

export interface DocumentGroup {
  key: string
  label: string
  records: DocumentSearchRecord[]
}

function uploadMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function groupKeyFor(record: DocumentSearchRecord, groupBy: GroupBy): string {
  switch (groupBy) {
    case "type":
      return record.document.type
    case "status":
      return record.document.extractionStatus
    case "upload-date":
      return uploadMonthKey(record.document.uploadedAt)
  }
}

function groupLabelFor(key: string, groupBy: GroupBy): string {
  switch (groupBy) {
    case "type":
      return key
    case "status":
      return EXTRACTION_STATUS_LABEL[key as ExtractionStatus]
    case "upload-date":
      return format(new Date(`${key}-01T00:00:00.000Z`), "MMMM yyyy")
  }
}

/** Where a group's key sorts within its groupBy dimension — lower sorts first. Upload-date
 * groups sort by the key string itself (YYYY-MM, so lexicographic already matches
 * chronological), most recent first. */
function groupOrderFor(key: string, groupBy: GroupBy): number | string {
  switch (groupBy) {
    case "type":
      return DOCUMENT_TYPES.indexOf(key as DocumentType)
    case "status":
      return EXTRACTION_STATUSES.indexOf(key as ExtractionStatus)
    case "upload-date":
      // Descending: negate lexicographic comparison by sorting on the reversed key string.
      return key
  }
}

export function groupRecords(records: DocumentSearchRecord[], groupBy: GroupBy): DocumentGroup[] {
  const byKey = new Map<string, DocumentSearchRecord[]>()
  for (const record of records) {
    const key = groupKeyFor(record, groupBy)
    const list = byKey.get(key) ?? []
    list.push(record)
    byKey.set(key, list)
  }
  const groups = [...byKey.entries()].map(([key, list]) => ({
    key,
    label: groupLabelFor(key, groupBy),
    records: list,
  }))
  groups.sort((a, b) => {
    if (groupBy === "upload-date") {
      // Most recent month first.
      return b.key.localeCompare(a.key)
    }
    const orderA = groupOrderFor(a.key, groupBy) as number
    const orderB = groupOrderFor(b.key, groupBy) as number
    return orderA - orderB
  })
  return groups
}
