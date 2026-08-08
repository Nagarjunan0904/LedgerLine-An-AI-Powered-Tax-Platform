import { ArrowLeft, ChevronRight } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router"

import { resolveFocusedObject, type FocusedObject } from "@/lib/focus"
import { documentLabel, returnLabel, shortFieldLabel, threadLabel } from "@/lib/labels"

interface Crumb {
  label: string
  /** Absent on the last crumb — you're already there, so it isn't a link. */
  to?: string
}

function crumbsForFocus(focus: FocusedObject): Crumb[] {
  if (focus.kind === "none") return []

  const crumbs: Crumb[] = [{ label: returnLabel(focus.ret), to: `/returns/${focus.ret.id}` }]
  switch (focus.kind) {
    case "return":
      break
    case "document":
      crumbs.push({ label: documentLabel(focus.document) })
      break
    case "field":
      crumbs.push({ label: focus.field.label })
      break
    case "thread":
      crumbs.push({ label: threadLabel(focus.thread) })
      break
    case "item":
      crumbs.push({ label: focus.item.title })
      break
  }
  const last = crumbs[crumbs.length - 1]
  crumbs[crumbs.length - 1] = { label: last.label }
  return crumbs
}

function backLabel(focus: FocusedObject): string {
  switch (focus.kind) {
    case "field":
      return `Back to ${shortFieldLabel(focus.field)} review`
    case "document":
      return `Back to ${documentLabel(focus.document)}`
    case "thread":
      return "Back to thread"
    case "item":
      return `Back to ${focus.item.title}`
    case "return":
      return `Back to ${returnLabel(focus.ret)}`
    case "none":
      return "Back"
  }
}

/** Parses a `from` value (a relative path + query, e.g. "/returns/x/review?field=1040-1a")
 * back into the same {params, searchParams} shape resolveFocusedObject expects. */
function parseFromUrl(fromValue: string): {
  params: Record<string, string | undefined>
  searchParams: URLSearchParams
} {
  const [path, search = ""] = fromValue.split("?")
  const segments = path.split("/").filter(Boolean)
  const params: Record<string, string | undefined> = {}
  if (segments[0] === "returns") {
    params.id = segments[1]
    if (segments[2] === "documents") params.docId = segments[3]
    if (segments[2] === "threads") params.threadId = segments[3]
  }
  return { params, searchParams: new URLSearchParams(search) }
}

function resolveBackTarget(fromValue: string | null): { to: string; label: string } | null {
  if (!fromValue) return null
  const { params, searchParams } = parseFromUrl(fromValue)
  const focus = resolveFocusedObject(params, searchParams)
  if (focus.kind === "none") return null
  return { to: fromValue, label: backLabel(focus) }
}

/**
 * Reflects the object hierarchy, not the URL path — resolves real names through the fixture
 * accessors so it reads "Ellery 2025 › W-2 (Acme Corp)" instead of "returns › ret_042 ›
 * documents › doc_118". Also surfaces the "Back to Line 1a review" affordance when the
 * current page was reached by navigating away from a review session (see connections.ts,
 * which is what attaches the `from` param in the first place).
 */
export function Breadcrumbs() {
  const params = useParams()
  const [searchParams] = useSearchParams()

  const focus = resolveFocusedObject(params, searchParams)
  const crumbs = crumbsForFocus(focus)
  const backTarget = resolveBackTarget(searchParams.get("from"))

  if (crumbs.length === 0 && !backTarget) return null

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-paper px-6 py-2">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 font-mono text-xs">
          {crumbs.map((crumb, i) => (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3 opacity-40" aria-hidden="true" />}
              {crumb.to ? (
                <Link to={crumb.to} className="opacity-70 hover:opacity-100 hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {backTarget && (
        <Link
          to={backTarget.to}
          className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 hover:underline"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          {backTarget.label}
        </Link>
      )}
    </div>
  )
}

export default Breadcrumbs
