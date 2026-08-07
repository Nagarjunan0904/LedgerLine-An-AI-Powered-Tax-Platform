import type { UserRef } from './user'

export type FieldState =
  | 'ai-suggested'
  | 'needs-review'
  | 'verified'
  | 'editable'
  | 'locked'

export type ClientPhase =
  | 'gathering-documents'
  | 'reviewing'
  | 'needs-your-answer'
  | 'ready-to-sign'
  | 'filed'

export type StaffState =
  | 'intake'
  | 'docs-pending'
  | 'extraction-review'
  | 'preparation'
  | 'open-items'
  | 'manager-review'
  | 'partner-review'
  | 'client-signature'
  | 'e-filed'

/** Blocking is a property of a return, never a status value. */
export interface Blocker {
  id: string
  reason: string
  owner: 'client' | 'firm'
  /** ISO 8601 timestamp */
  since: string
}

export interface AuditEntry {
  id: string
  fieldId: string
  /** ISO 8601 timestamp */
  at: string
  by: UserRef
  previousValue: number | string
  newValue: number | string
  previousState: FieldState
  newState: FieldState
}

export interface ReturnField {
  id: string
  returnId: string
  /** e.g. '1040-1a' */
  formLine: string
  label: string
  value: number | string
  state: FieldState
  provenanceId: string | null
  lockReason?: string
  audit: AuditEntry[]
}

export interface Return {
  id: string
  clientId: UserRef
  clientName: string
  taxYear: number
  clientPhase: ClientPhase
  staffState: StaffState
  ownerRole: 'client' | 'firm'
  assignedTo: UserRef | null
  /** ISO 8601 timestamp */
  dueDate: string
  blockers: Blocker[]
}
