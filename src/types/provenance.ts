import type { UserRef } from './user.ts'

export type TransformStep =
  | { op: 'direct'; sourceId: string }
  | { op: 'sum'; sourceIds: string[] }
  | { op: 'subtract'; sourceIds: string[] }
  | { op: 'multiply'; sourceId: string; factor: number }
  | { op: 'lookup'; table: string; key: string }
  | { op: 'manual-entry'; enteredBy: UserRef; reason: string }

export type ProvenanceMethod =
  | 'extracted'
  | 'derived'
  | 'client-entered'
  | 'preparer-entered'

export interface Provenance {
  id: string
  targetFieldId: string
  sourceFieldIds: string[]
  transform: TransformStep[]
  /** 0–1 */
  confidence: number
  method: ProvenanceMethod
  verification: { by: UserRef; at: string } | null
}
