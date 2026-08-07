export type UserKind = 'client' | 'staff'

export interface User {
  id: string
  name: string
  email: string
  kind: UserKind
}

/** A user id, used wherever a field references a user without embedding it. */
export type UserRef = string
