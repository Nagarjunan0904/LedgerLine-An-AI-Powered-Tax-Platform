import type { Message, Thread, UserRef } from "@/types"

/**
 * The single rule for "is this thread waiting on a reply" — what ThreadPanel's owner header
 * reads. generate.ts duplicates isOutstandingRequest's two lines at seed time (it runs under
 * its own tsconfig with no "@/" alias, so it can't import this file directly) rather than
 * diverge from it — see that file's own comment. A question asked is a task created; this is
 * the fact that link is built on.
 */
export function latestMessageOf(thread: Thread): Message | null {
  return thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null
}

/** True when nobody has replied to the thread's latest ask yet. */
export function isOutstandingRequest(thread: Thread): boolean {
  if (thread.resolvedAt !== null) return false
  const last = latestMessageOf(thread)
  return last !== null && last.isRequest
}

/**
 * Who the next action sits with: the participant who isn't the latest message's author, while
 * that message is an unanswered ask. Null once resolved, once the latest message isn't a
 * request, or when no other participant is on record to hand it to.
 */
export function threadOwner(thread: Thread): UserRef | null {
  if (!isOutstandingRequest(thread)) return null
  const last = latestMessageOf(thread)
  if (!last) return null
  return thread.participants.find((p) => p !== last.authorId) ?? null
}
