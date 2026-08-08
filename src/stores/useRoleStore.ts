import { create } from "zustand"

import type { Role } from "@/types"

interface RoleState {
  role: Role
  setRole: (role: Role) => void
}

/**
 * The active role for the current session. There's no auth yet, so this is the whole
 * session model for now — 2.2 builds a real role switcher on top of this store; routing
 * and any other role-aware code should read `role` here rather than track their own copy.
 */
export const useRoleStore = create<RoleState>((set) => ({
  role: "preparer",
  setRole: (role) => set({ role }),
}))

/** Client-facing roles (see a return as its owner) vs. firm roles (work returns in a queue). */
export function isClientRole(role: Role): boolean {
  return role === "individual" || role === "business-owner"
}
