import { create } from "zustand"

import type { Return, Role } from "@/types"
import { DEMO_IDS, getReturns } from "@/data/fixtures"

export type WorkContext = "firm" | "personal"

interface RoleState {
  role: Role
  /** The signed-in user for the active role. Role and identity are coupled in this demo. */
  userId: string
  /**
   * "firm" (working the firm's queue) or "personal" (viewing their own return as its
   * client). Only meaningful for a dual-role user like Nadia — see isDualRoleUser below.
   * Resets to "firm" on every role/user switch.
   */
  context: WorkContext
  setRole: (role: Role, userId: string) => void
  setContext: (context: WorkContext) => void
}

/**
 * There's no auth yet, so this store *is* the session: which role, which user, and (for
 * dual-role users) which context. 2.2's RoleSwitcher writes to this; anything role-aware
 * should read it rather than track its own copy. Defaults to preparer / Nadia Osei, matching
 * the default this store shipped with in 2.1.
 */
export const useRoleStore = create<RoleState>((set) => ({
  role: "preparer",
  userId: DEMO_IDS.NADIA_OSEI_USER,
  context: "firm",
  setRole: (role, userId) => set({ role, userId, context: "firm" }),
  setContext: (context) => set({ context }),
}))

/** Client-facing roles (see a return as its owner) vs. firm roles (work returns in a queue). */
export function isClientRole(role: Role): boolean {
  return role === "individual" || role === "business-owner"
}

/**
 * The role that should actually drive permissions, nav, and data scoping right now. Equal to
 * `role` except when a dual-role user has switched into their personal context — the role
 * switcher still reads "preparer", but capabilities and data scoping should treat them as an
 * ordinary client on that one return.
 */
export function getEffectiveRole(role: Role, context: WorkContext): Role {
  return context === "personal" ? "individual" : role
}

/** A user is their own client on some return — the case that needs the dual-context switch. */
export function getPersonalReturnForUser(userId: string): Return | undefined {
  return getReturns().find((r) => r.clientId === userId)
}

/** The context control only appears for users who actually have both a role and a return. */
export function isDualRoleUser(role: Role, userId: string): boolean {
  return !isClientRole(role) && getPersonalReturnForUser(userId) !== undefined
}
