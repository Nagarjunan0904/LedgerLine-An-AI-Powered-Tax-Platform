import { Link, useLocation, useParams, useSearchParams } from "react-router"

import { getConnections } from "@/lib/connections"
import { resolveFocusedObject, type FocusedObject } from "@/lib/focus"
import { documentLabel, returnLabel, threadLabel } from "@/lib/labels"
import { getEffectiveRole, useRoleStore } from "@/stores/useRoleStore"

function focusKindLabel(kind: FocusedObject["kind"]): string {
  switch (kind) {
    case "field":
      return "This field"
    case "document":
      return "This document"
    case "thread":
      return "This thread"
    case "item":
      return "This open item"
    case "return":
      return "This return"
    case "none":
      return ""
  }
}

function focusName(focus: FocusedObject): string {
  switch (focus.kind) {
    case "field":
      return focus.field.label
    case "document":
      return documentLabel(focus.document)
    case "thread":
      return threadLabel(focus.thread)
    case "item":
      return focus.item.title
    case "return":
      return returnLabel(focus.ret)
    case "none":
      return ""
  }
}

/**
 * The right rail's content — AppShell owns the reserved, sized slot it renders into.
 * Shows the focused object's live connections, grouped by relationship type with a count,
 * computed at render time from src/data/fixtures.ts. Falls back to the return's own
 * connections when nothing more specific is focused, so the panel is never empty within a
 * return's context.
 */
export function ContextRail() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const effectiveRole = getEffectiveRole(role, context)

  const focus = resolveFocusedObject(params, searchParams)

  if (focus.kind === "none") {
    return (
      <div>
        <p className="font-mono text-[0.6875rem] uppercase tracking-wide opacity-40">Context</p>
        <p className="mt-2 text-sm opacity-50">No return in view.</p>
      </div>
    )
  }

  const groups = getConnections(focus, effectiveRole, `${location.pathname}${location.search}`)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-[0.6875rem] uppercase tracking-wide opacity-40">
          {focusKindLabel(focus.kind)}
        </p>
        <p className="mt-0.5 font-medium leading-snug">{focusName(focus)}</p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm opacity-50">No connections yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={`${group.verb}-${group.noun}`}>
              <p className="mb-1 text-xs opacity-60">
                <span aria-hidden="true">{group.arrow}</span> {group.verb} {group.entries.length}{" "}
                {group.noun}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.entries.map((entry) => (
                  <li key={entry.to}>
                    <Link
                      to={entry.to}
                      title={entry.label}
                      className="block truncate rounded-sm px-2 py-1 text-sm hover:bg-panel"
                    >
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ContextRail
