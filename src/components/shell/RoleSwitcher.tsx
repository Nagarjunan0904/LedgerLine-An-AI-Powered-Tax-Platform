import { ChevronDown } from "lucide-react"

import type { Role } from "@/types"
import { getUser } from "@/data/fixtures"
import { useRoleStore } from "@/stores/useRoleStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLE_LABEL: Record<Role, string> = {
  individual: "Individual",
  "business-owner": "Business owner",
  preparer: "Preparer",
  reviewer: "Reviewer",
  "firm-admin": "Firm admin",
  seasonal: "Seasonal preparer",
}

/**
 * Which seeded user signs in as each role. individual/preparer/reviewer point at users with
 * real fixture depth (returns, documents, open items); the other three point at ordinary
 * seeded users so the shell and permission set are fully real, even though there's little
 * story behind them yet — hence the "limited demo" note.
 */
const ROLE_DEMO_USERS: Record<Role, string> = {
  individual: "user-marcus-ellery",
  "business-owner": "user-priya-voss",
  preparer: "user-nadia-osei",
  reviewer: "user-0002",
  "firm-admin": "user-0003",
  seasonal: "user-0005",
}

const FULLY_FUNCTIONAL_ROLES = new Set<Role>(["individual", "preparer", "reviewer"])

const ROLE_ORDER: Role[] = [
  "individual",
  "business-owner",
  "preparer",
  "reviewer",
  "firm-admin",
  "seasonal",
]

/**
 * The one control that changes who's signed in. Switching role always switches the user
 * with it (role and identity are coupled in this demo) — see useRoleStore.setRole.
 */
export function RoleSwitcher() {
  const role = useRoleStore((s) => s.role)
  const userId = useRoleStore((s) => s.userId)
  const setRole = useRoleStore((s) => s.setRole)

  const user = getUser(userId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 text-sm hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex flex-col items-start leading-tight">
            <span className="font-medium">{user?.name ?? userId}</span>
            <span className="font-mono text-[0.6875rem] uppercase tracking-wide opacity-60">
              {ROLE_LABEL[role]}
            </span>
          </span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Switch role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(next) => setRole(next as Role, ROLE_DEMO_USERS[next as Role])}
        >
          {ROLE_ORDER.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              <span className="flex-1">{ROLE_LABEL[r]}</span>
              {!FULLY_FUNCTIONAL_ROLES.has(r) && (
                <span className="font-mono text-[0.625rem] uppercase tracking-wide opacity-50">
                  Limited demo
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default RoleSwitcher
