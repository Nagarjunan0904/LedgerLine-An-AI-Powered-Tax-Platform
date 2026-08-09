import { create } from "zustand"

import type { Message, ObjectRef, Thread, UserRef } from "@/types"

export interface PostMessageInput {
  scope: ObjectRef
  visibility: Thread["visibility"]
  /** The thread to append to, or null to start a new one for this scope + visibility. */
  existingThreadId: string | null
  authorId: UserRef
  body: string
  isRequest: boolean
  /** The other participant, when starting a brand-new thread and one is already known (the
   * return's client, for a client-visible ask). Internal notes usually don't have a fixed
   * second participant at creation time, so this is optional. */
  otherParticipant?: UserRef | null
}

interface ThreadsState {
  /** Messages posted this session, keyed by the thread they belong to — whether that thread
   * came from the fixtures or was itself created this session. Fixture threads are never
   * mutated; every reader merges this over them at render time. */
  postedMessages: Record<string, Message[]>
  /** Brand-new threads created this session — a scope + visibility that had no fixture thread
   * yet — keyed by their own id. */
  newThreads: Record<string, Thread>
  postMessage: (input: PostMessageInput) => void
}

let nextMessageId = 1
let nextThreadId = 1

/**
 * In-memory only, resets on reload — same tradeoff as every other mutation store in this
 * prototype (see CLAUDE.md). Posting a message either appends to an existing thread or, for
 * the first message in a scope + visibility that has none yet, creates one.
 */
export const useThreadsStore = create<ThreadsState>((set) => ({
  postedMessages: {},
  newThreads: {},
  postMessage: (input) =>
    set((state) => {
      const threadId = input.existingThreadId ?? `local-thread-${nextThreadId++}`
      const message: Message = {
        id: `local-msg-${nextMessageId++}`,
        threadId,
        authorId: input.authorId,
        body: input.body,
        sentAt: new Date().toISOString(),
        isRequest: input.isRequest,
      }
      const existing = state.postedMessages[threadId]
      const postedMessages = {
        ...state.postedMessages,
        [threadId]: existing ? [...existing, message] : [message],
      }

      if (input.existingThreadId) {
        return { postedMessages }
      }

      const participants: UserRef[] = input.otherParticipant
        ? [input.authorId, input.otherParticipant]
        : [input.authorId]
      const newThread: Thread = {
        id: threadId,
        scope: input.scope,
        visibility: input.visibility,
        participants,
        messages: [],
        resolvedAt: null,
      }
      return { postedMessages, newThreads: { ...state.newThreads, [threadId]: newThread } }
    }),
}))
