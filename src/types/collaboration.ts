import type { UserRef } from './user.ts'

export type Severity = 'low' | 'medium' | 'high'

/** Points at another object in the model, wherever one object references another. */
export interface ObjectRef {
  type: 'field' | 'document' | 'return' | 'item' | 'thread'
  id: string
}

export interface Message {
  id: string
  threadId: string
  authorId: UserRef
  body: string
  /** ISO 8601 timestamp */
  sentAt: string
  isRequest: boolean
}

export interface Thread {
  id: string
  scope: ObjectRef
  visibility: 'internal' | 'client-visible'
  participants: UserRef[]
  messages: Message[]
  /** ISO 8601 timestamp, or null while unresolved */
  resolvedAt: string | null
}

export interface OpenItem {
  id: string
  returnId: string
  title: string
  description: string
  owner: 'client' | 'firm'
  assignedTo: UserRef | null
  /** ISO 8601 timestamp */
  dueDate: string
  severity: Severity
  linkedObjects: ObjectRef[]
  /** ISO 8601 timestamp, or null while unresolved */
  resolvedAt: string | null
}
