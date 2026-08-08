import { NavLink, Outlet } from "react-router"

import type { Role } from "@/types"
import { getReturnsForUser } from "@/data/fixtures"
import { CAPABILITY_REASON, can } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import {
  getEffectiveRole,
  isClientRole,
  isDualRoleUser,
  useRoleStore,
  type WorkContext,
} from "@/stores/useRoleStore"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Breadcrumbs } from "./Breadcrumbs"
import { ContextRail } from "./ContextRail"
import { RoleSwitcher } from "./RoleSwitcher"

interface NavItem {
  label: string
  to: string
}

/** Built from role, not filtered with CSS afterward — an item a role can't use isn't rendered. */
function buildNavItems(effectiveRole: Role, userId: string): NavItem[] {
  const items: NavItem[] = [
    { label: "Home", to: "/home" },
    { label: isClientRole(effectiveRole) ? "My return" : "Returns", to: "/returns" },
  ]
  if (isClientRole(effectiveRole)) {
    const ownReturn = getReturnsForUser(userId, effectiveRole)[0]
    if (ownReturn) {
      items.push(
        { label: "My documents", to: `/returns/${ownReturn.id}/documents` },
        { label: "My open items", to: `/returns/${ownReturn.id}/items` }
      )
    }
  }
  return items
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-sm px-2.5 py-1.5 text-sm",
    isActive ? "bg-panel font-medium" : "opacity-70 hover:opacity-100 hover:bg-panel/60"
  )

/** A capability-gated control disabled without an onClick, but never with the `disabled`
 * attribute — a truly disabled button won't fire the hover/focus events the tooltip needs. */
function FileReturnControl({ role }: { role: Role }) {
  const allowed = can(role, "canFileReturn")
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled={!allowed}
          onClick={allowed ? undefined : (e) => e.preventDefault()}
          className={cn(
            "rounded-sm border border-border px-2.5 py-1.5 text-sm font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            allowed ? "hover:bg-panel" : "cursor-not-allowed opacity-40"
          )}
        >
          File return
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {allowed ? "File this return with the IRS." : CAPABILITY_REASON.canFileReturn}
      </TooltipContent>
    </Tooltip>
  )
}

/** Distinct from the role switcher — Nadia stays signed in as herself the whole time; this
 * only changes which of her two hats is active. Never both at once. */
function ContextSwitch({ context, onChange }: { context: WorkContext; onChange: (c: WorkContext) => void }) {
  return (
    <div className="flex rounded-sm border border-border p-0.5 text-sm" role="group" aria-label="Workspace context">
      {(["firm", "personal"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={context === c}
          onClick={() => onChange(c)}
          className={cn(
            "rounded-[2px] px-2.5 py-1 font-medium",
            context === c ? "bg-ink text-paper" : "opacity-60 hover:opacity-100"
          )}
        >
          {c === "firm" ? "Firm workspace" : "My personal return"}
        </button>
      ))}
    </div>
  )
}

/**
 * Persists across navigation (it's the layout route's element, not remounted per-page) so
 * scroll position and any shell-level state survive route changes.
 */
export function AppShell() {
  const role = useRoleStore((s) => s.role)
  const userId = useRoleStore((s) => s.userId)
  const context = useRoleStore((s) => s.context)
  const setContext = useRoleStore((s) => s.setContext)

  const effectiveRole = getEffectiveRole(role, context)
  const showContextSwitch = isDualRoleUser(role, userId)
  const navItems = buildNavItems(effectiveRole, userId)

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <span className="font-display text-sm font-bold uppercase tracking-widest">Ledgerline</span>
        <div className="flex items-center gap-3">
          {!isClientRole(effectiveRole) && <FileReturnControl role={effectiveRole} />}
          {showContextSwitch && <ContextSwitch context={context} onChange={setContext} />}
          <RoleSwitcher />
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-56 shrink-0 border-r border-border p-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={navLinkClassName}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-border pt-4">
            <p className="px-2.5 font-mono text-[0.6875rem] uppercase tracking-wide opacity-40 mb-1">
              Reference
            </p>
            <ul className="space-y-0.5">
              <li>
                <NavLink to="/kitchen-sink" className={navLinkClassName}>
                  Kitchen sink
                </NavLink>
              </li>
              <li>
                <NavLink to="/tokens" className={navLinkClassName}>
                  Tokens
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto">
          <Breadcrumbs />
          <Outlet />
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-panel/40 p-4">
          <ContextRail />
        </aside>
      </div>
    </div>
  )
}

export default AppShell
