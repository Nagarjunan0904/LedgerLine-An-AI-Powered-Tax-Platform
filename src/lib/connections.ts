import type { ObjectRef, OpenItem, Return, Thread } from "@/types"
import {
  getDocument,
  getDocumentsForReturn,
  getExtractedField,
  getExtractedFieldsForDocument,
  getFieldsForReturn,
  getOpenItemsForReturn,
  getProvenance,
  getReturn,
  getThread,
  getThreadsForObject,
} from "@/data/fixtures"
import type { WorkContext } from "@/stores/useRoleStore"
import type { FocusedObject } from "./focus"
import { documentLabel, returnLabel, threadLabel } from "./labels"

export interface ConnectionEntry {
  label: string
  to: string
}

export interface ConnectionGroup {
  /** "derived from", "referenced by", "has", "blocks", "references", "about" */
  verb: string
  /** ← = this object was built FROM these; → = this object points to / affects these. */
  arrow: "←" | "→"
  /** e.g. "document", "return field" — singular or plural already chosen for the count. */
  noun: string
  entries: ConnectionEntry[]
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`
}

function unresolved<T extends { resolvedAt: string | null }>(list: T[]): T[] {
  return list.filter((x) => x.resolvedAt === null)
}

/** In personal context, a dual-role user's rail must not surface firm-only objects. */
function visibleThreads(threads: Thread[], context: WorkContext): Thread[] {
  return context === "personal" ? threads.filter((t) => t.visibility === "client-visible") : threads
}

function documentLink(ret: Return, documentId: string): string {
  return `/returns/${ret.id}/documents/${documentId}`
}
function fieldLink(ret: Return, formLine: string): string {
  return `/returns/${ret.id}/review?field=${encodeURIComponent(formLine)}`
}
function itemLink(ret: Return, item: OpenItem): string {
  return `/returns/${ret.id}/items?item=${item.id}`
}
function threadLink(ret: Return, threadId: string): string {
  return `/returns/${ret.id}/threads/${threadId}`
}

function resolveObjectRef(ref: ObjectRef, ret: Return): ConnectionEntry | null {
  switch (ref.type) {
    case "document": {
      const doc = getDocument(ref.id)
      return doc ? { label: documentLabel(doc), to: documentLink(ret, doc.id) } : null
    }
    case "field": {
      const field = getFieldsForReturn(ret.id).find((f) => f.id === ref.id)
      return field ? { label: field.label, to: fieldLink(ret, field.formLine) } : null
    }
    case "return": {
      const r = ref.id === ret.id ? ret : getReturn(ref.id)
      return r ? { label: returnLabel(r), to: `/returns/${r.id}` } : null
    }
    case "item": {
      const item = getOpenItemsForReturn(ret.id).find((i) => i.id === ref.id)
      return item ? { label: item.title, to: itemLink(ret, item) } : null
    }
    case "thread": {
      const thread = getThread(ref.id)
      return thread ? { label: threadLabel(thread), to: threadLink(ret, thread.id) } : null
    }
  }
}

const REF_NOUN: Record<ObjectRef["type"], string> = {
  field: "field",
  document: "document",
  return: "return",
  item: "open item",
  thread: "thread",
}

/** OpenItem.linkedObjects can mix types — one group per type, per "group by relationship type". */
function referencesGroups(refs: ObjectRef[], ret: Return): ConnectionGroup[] {
  const byType = new Map<ObjectRef["type"], ConnectionEntry[]>()
  for (const ref of refs) {
    const entry = resolveObjectRef(ref, ret)
    if (!entry) continue
    const list = byType.get(ref.type) ?? []
    list.push(entry)
    byType.set(ref.type, list)
  }
  return [...byType.entries()].map(([type, entries]) => ({
    verb: "references",
    arrow: "→" as const,
    noun: pluralize(entries.length, REF_NOUN[type]),
    entries,
  }))
}

function threadGroup(scopeRef: ObjectRef, ret: Return, context: WorkContext): ConnectionGroup | null {
  const threads = unresolved(visibleThreads(getThreadsForObject(scopeRef), context))
  if (threads.length === 0) return null
  return {
    verb: "has",
    arrow: "→",
    noun: pluralize(threads.length, "open thread"),
    entries: threads.map((t) => ({ label: threadLabel(t), to: threadLink(ret, t.id) })),
  }
}

function openItemsGroup(items: OpenItem[], ret: Return): ConnectionGroup | null {
  if (items.length === 0) return null
  return {
    verb: "has",
    arrow: "→",
    noun: pluralize(items.length, "open item"),
    entries: items.map((i) => ({ label: i.title, to: itemLink(ret, i) })),
  }
}

function buildGroups(focus: FocusedObject, context: WorkContext): ConnectionGroup[] {
  if (focus.kind === "none") return []
  const groups: ConnectionGroup[] = []
  const { ret } = focus

  if (focus.kind === "return") {
    const docs = getDocumentsForReturn(ret.id)
    if (docs.length > 0) {
      groups.push({
        verb: "has",
        arrow: "→",
        noun: pluralize(docs.length, "document"),
        entries: docs.map((d) => ({ label: documentLabel(d), to: documentLink(ret, d.id) })),
      })
    }
    const fields = getFieldsForReturn(ret.id)
    if (fields.length > 0) {
      groups.push({
        verb: "has",
        arrow: "→",
        noun: pluralize(fields.length, "field"),
        entries: fields.map((f) => ({ label: f.label, to: fieldLink(ret, f.formLine) })),
      })
    }
    const items = openItemsGroup(unresolved(getOpenItemsForReturn(ret.id)), ret)
    if (items) groups.push(items)
    const threadsGroup = threadGroup({ type: "return", id: ret.id }, ret, context)
    if (threadsGroup) groups.push(threadsGroup)
    return groups
  }

  if (focus.kind === "field") {
    const prov = getProvenance(focus.field.id)
    if (prov && prov.sourceFieldIds.length > 0) {
      const seenDocIds = new Set<string>()
      const entries = []
      for (const sourceId of prov.sourceFieldIds) {
        const ext = getExtractedField(sourceId)
        if (!ext || seenDocIds.has(ext.documentId)) continue
        const doc = getDocument(ext.documentId)
        if (!doc) continue
        seenDocIds.add(doc.id)
        entries.push({ label: documentLabel(doc), to: documentLink(ret, doc.id) })
      }
      if (entries.length > 0) {
        groups.push({
          verb: "derived from",
          arrow: "←",
          noun: pluralize(entries.length, "document"),
          entries,
        })
      }
    }

    const threadsGroup = threadGroup({ type: "field", id: focus.field.id }, ret, context)
    if (threadsGroup) groups.push(threadsGroup)

    const items = openItemsGroup(
      unresolved(getOpenItemsForReturn(ret.id)).filter((i) =>
        i.linkedObjects.some((r) => r.type === "field" && r.id === focus.field.id)
      ),
      ret
    )
    if (items) groups.push(items)
    return groups
  }

  if (focus.kind === "document") {
    const docExtractedIds = new Set(getExtractedFieldsForDocument(focus.document.id).map((e) => e.id))
    if (docExtractedIds.size > 0) {
      const referencingFields = getFieldsForReturn(ret.id).filter((f) => {
        const prov = getProvenance(f.id)
        return prov ? prov.sourceFieldIds.some((id) => docExtractedIds.has(id)) : false
      })
      if (referencingFields.length > 0) {
        groups.push({
          verb: "referenced by",
          arrow: "→",
          noun: pluralize(referencingFields.length, "return field"),
          entries: referencingFields.map((f) => ({ label: f.label, to: fieldLink(ret, f.formLine) })),
        })
      }
    }

    const threadsGroup = threadGroup({ type: "document", id: focus.document.id }, ret, context)
    if (threadsGroup) groups.push(threadsGroup)

    const items = openItemsGroup(
      unresolved(getOpenItemsForReturn(ret.id)).filter((i) =>
        i.linkedObjects.some((r) => r.type === "document" && r.id === focus.document.id)
      ),
      ret
    )
    if (items) groups.push(items)
    return groups
  }

  if (focus.kind === "thread") {
    const scopeEntry = resolveObjectRef(focus.thread.scope, ret)
    if (scopeEntry) {
      groups.push({
        verb: "about",
        arrow: "←",
        noun: REF_NOUN[focus.thread.scope.type],
        entries: [scopeEntry],
      })
    }
    return groups
  }

  // focus.kind === "item"
  groups.push(...referencesGroups(focus.item.linkedObjects, ret))
  if (!focus.item.resolvedAt && ret.blockers.length > 0) {
    groups.push({
      verb: "blocks",
      arrow: "→",
      noun: "return's status",
      entries: [{ label: returnLabel(ret), to: `/returns/${ret.id}` }],
    })
  }
  const threadsGroup = threadGroup({ type: "item", id: focus.item.id }, ret, context)
  if (threadsGroup) groups.push(threadsGroup)
  return groups
}

function appendFrom(to: string, fromValue: string): string {
  const separator = to.includes("?") ? "&" : "?"
  return `${to}${separator}from=${encodeURIComponent(fromValue)}`
}

/**
 * Every relationship this app models, computed at render time from the fixture accessors —
 * never raw JSON — grouped by relationship type with a count, each entry a link.
 *
 * `currentLocation` (pathname + search of the page the rail is rendered on) is only used
 * when the focus is a field: leaving a review session should carry a `from` param so the
 * destination can offer a "Back to Line 1a review" affordance (see Breadcrumbs.tsx).
 */
export function getConnections(
  focus: FocusedObject,
  context: WorkContext,
  currentLocation: string
): ConnectionGroup[] {
  const groups = buildGroups(focus, context)
  if (focus.kind !== "field") return groups
  return groups.map((group) => ({
    ...group,
    entries: group.entries.map((entry) => ({ ...entry, to: appendFrom(entry.to, currentLocation) })),
  }))
}
