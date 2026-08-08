import type { Document, Return, ReturnField, Thread } from "@/types"

/**
 * Display-name formatting shared by ContextRail and Breadcrumbs, so the two components
 * never resolve the same object to two different-looking labels.
 */

/** "Marcus Ellery" + 2025 → "Ellery 2025". Falls back to the full name for single-word ones. */
export function returnLabel(ret: Return): string {
  const parts = ret.clientName.trim().split(/\s+/)
  const surname = parts.length > 1 ? parts[parts.length - 1] : ret.clientName
  return `${surname} ${ret.taxYear}`
}

/**
 * "Acme Corp W-2 2025.pdf" → "Acme Corp". Null when the filename doesn't follow the
 * generator's "payer type year" naming (e.g. the deliberately-messy failed-extraction
 * receipt) — there's no payer to extract, and callers should treat that as absent rather
 * than fall back to a guess.
 */
export function documentPayerName(doc: Document): string | null {
  const withoutExt = doc.fileName.replace(/\.\w+$/, "")
  const escapedType = doc.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const stripped = withoutExt
    .replace(new RegExp(`\\s+${escapedType}\\s+\\d{4}.*$`, "i"), "")
    .trim()
  return stripped && stripped !== withoutExt ? stripped : null
}

/** "Acme Corp W-2 2025.pdf" → "W-2 (Acme Corp)". Falls back to the bare filename when
 * documentPayerName can't find a payer in it. */
export function documentLabel(doc: Document): string {
  const payer = documentPayerName(doc)
  return payer ? `${doc.type} (${payer})` : doc.fileName.replace(/\.\w+$/, "")
}

/** "1040-1a" → "Line 1a". Other form-line shapes (e.g. "Sch B-2") pass through unchanged. */
export function shortFieldLabel(field: ReturnField): string {
  const match = /^1040-(.+)$/.exec(field.formLine)
  return match ? `Line ${match[1]}` : field.formLine
}

/** "Box 1 — Wages, tips, other compensation" -> { number: "1", description: "Wages, tips,
 * other compensation" }. Shared by MockFormRenderer (the box's own caption) and
 * ProvenanceChain (a source row's box label) so both read the same real fixture text instead
 * of two hand-typed copies that could drift apart. */
export function parseBoxLabel(label: string): { number: string; description: string } {
  const match = /^Box\s+(\S+)\s+—\s+(.+)$/.exec(label)
  return match ? { number: match[1], description: match[2] } : { number: "", description: label }
}

/** Threads have no title — the first message's opening words stand in for one. */
export function threadLabel(thread: Thread): string {
  const first = thread.messages[0]
  if (!first) return "Thread"
  const body = first.body.trim()
  return body.length > 44 ? `${body.slice(0, 43).trimEnd()}…` : body
}
