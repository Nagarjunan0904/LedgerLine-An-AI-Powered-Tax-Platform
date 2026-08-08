import type { Role, RoleCapabilities, RoleCapabilityMap } from "@/types"

/**
 * The whole permission model, one row per role — read top to bottom.
 *
 * individual and business-owner are intentionally identical: what separates them is which
 * forms they see (Schedule C vs. not), not what they're allowed to do. Same for reviewer and
 * firm-admin — the difference between those two lives outside this table (user management,
 * firm settings), not in the tax-prep workflow this type models.
 */
export const ROLE_CAPABILITIES: RoleCapabilityMap = {
  individual: {
    canEditFields: true,
    canApproveAI: false,
    canSeeInternalNotes: false,
    canAdvanceStatus: false,
    canViewAllReturns: false,
    canFileReturn: false,
  },
  "business-owner": {
    canEditFields: true,
    canApproveAI: false,
    canSeeInternalNotes: false,
    canAdvanceStatus: false,
    canViewAllReturns: false,
    canFileReturn: false,
  },
  preparer: {
    canEditFields: true,
    canApproveAI: true,
    canSeeInternalNotes: true,
    canAdvanceStatus: true,
    canViewAllReturns: false,
    canFileReturn: false,
  },
  reviewer: {
    canEditFields: true,
    canApproveAI: true,
    canSeeInternalNotes: true,
    canAdvanceStatus: true,
    canViewAllReturns: true,
    canFileReturn: true,
  },
  "firm-admin": {
    canEditFields: true,
    canApproveAI: true,
    canSeeInternalNotes: true,
    canAdvanceStatus: true,
    canViewAllReturns: true,
    canFileReturn: true,
  },
  seasonal: {
    canEditFields: true,
    canApproveAI: false,
    canSeeInternalNotes: true,
    canAdvanceStatus: false,
    canViewAllReturns: false,
    canFileReturn: false,
  },
}

export function can(role: Role, capability: keyof RoleCapabilities): boolean {
  return ROLE_CAPABILITIES[role][capability]
}

/**
 * Shown on hover when a capability-gated control is disabled. Silently missing UI teaches
 * users nothing — this is the sentence that teaches them the model instead.
 */
export const CAPABILITY_REASON: Record<keyof RoleCapabilities, string> = {
  canEditFields: "This role can't edit return fields.",
  canApproveAI: "Preparer role or above is required to approve AI suggestions.",
  canSeeInternalNotes: "Internal notes are only visible to firm staff.",
  canAdvanceStatus: "Preparer role or above is required to advance a return's status.",
  canViewAllReturns: "Only reviewers and firm admins can view every return in the firm.",
  canFileReturn: "Reviewer approval is required before a return can be filed.",
}
