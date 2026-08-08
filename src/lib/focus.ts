import type { Document, OpenItem, Return, ReturnField, Thread } from "@/types"
import {
  getDocument,
  getFieldsForReturn,
  getOpenItemsForReturn,
  getReturn,
  getThread,
} from "@/data/fixtures"

export type FocusedObject =
  | { kind: "field"; field: ReturnField; ret: Return }
  | { kind: "document"; document: Document; ret: Return }
  | { kind: "thread"; thread: Thread; ret: Return }
  | { kind: "item"; item: OpenItem; ret: Return }
  | { kind: "return"; ret: Return }
  | { kind: "none" }

/**
 * The single source of truth for "what does this URL mean" — ContextRail and Breadcrumbs
 * both resolve focus through this, so they can never disagree about what's on screen.
 *
 * Priority when more than one signal is present: the field/item search params (a specific
 * sub-focus within a page — there's no dedicated route for either) beat the docId/threadId
 * route params (which page you're on), which beat the bare return id. See routes.tsx for
 * which params exist on which route.
 */
export function resolveFocusedObject(
  params: Record<string, string | undefined>,
  searchParams: URLSearchParams
): FocusedObject {
  const returnId = params.id
  if (!returnId) return { kind: "none" }
  const ret = getReturn(returnId)
  if (!ret) return { kind: "none" }

  const fieldParam = searchParams.get("field")
  if (fieldParam) {
    const field = getFieldsForReturn(ret.id).find((f) => f.formLine === fieldParam)
    if (field) return { kind: "field", field, ret }
  }

  const itemParam = searchParams.get("item")
  if (itemParam) {
    const item = getOpenItemsForReturn(ret.id).find((i) => i.id === itemParam)
    if (item) return { kind: "item", item, ret }
  }

  if (params.docId) {
    const document = getDocument(params.docId)
    if (document && document.returnId === ret.id) return { kind: "document", document, ret }
  }

  if (params.threadId) {
    const thread = getThread(params.threadId)
    if (thread) return { kind: "thread", thread, ret }
  }

  return { kind: "return", ret }
}
