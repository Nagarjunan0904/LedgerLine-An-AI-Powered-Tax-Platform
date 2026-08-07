export type Role =
  | 'individual'
  | 'business-owner'
  | 'preparer'
  | 'reviewer'
  | 'firm-admin'
  | 'seasonal'

export interface RoleCapabilities {
  canEditFields: boolean
  canApproveAI: boolean
  canSeeInternalNotes: boolean
  canAdvanceStatus: boolean
  canViewAllReturns: boolean
  canFileReturn: boolean
}

export type RoleCapabilityMap = Record<Role, RoleCapabilities>
