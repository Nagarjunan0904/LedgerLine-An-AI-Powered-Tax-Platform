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
 * "Acme Corp W-2 2025.pdf" → "W-2 (Acme Corp)". Falls back to the bare filename when it
 * doesn't follow the generator's "payer type year" naming (e.g. the deliberately-messy
 * failed-extraction receipt).
 */
export function documentLabel(doc: Document): string {
  const withoutExt = doc.fileName.replace(/\.\w+$/, "")
  const escapedType = doc.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const stripped = withoutExt
    .replace(new RegExp(`\\s+${escapedType}\\s+\\d{4}.*$`, "i"), "")
    .trim()
  return stripped && stripped !== withoutExt ? `${doc.type} (${stripped})` : withoutExt
}

/** "1040-1a" → "Line 1a". Other form-line shapes (e.g. "Sch B-2") pass through unchanged. */
export function shortFieldLabel(field: ReturnField): string {
  const match = /^1040-(.+)$/.exec(field.formLine)
  return match ? `Line ${match[1]}` : field.formLine
}

/** Threads have no title — the first message's opening words stand in for one. */
export function threadLabel(thread: Thread): string {
  const first = thread.messages[0]
  if (!first) return "Thread"
  const body = first.body.trim()
  return body.length > 44 ? `${body.slice(0, 43).trimEnd()}…` : body
}
