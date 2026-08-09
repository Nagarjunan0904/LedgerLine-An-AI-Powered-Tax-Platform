import { useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router"
import { format } from "date-fns"
import { HelpCircle, MessageSquareText } from "lucide-react"

import type { Message, ObjectRef, Return, Role, Thread } from "@/types"
import { getThreadsForObject, getUser } from "@/data/fixtures"
import { resolveFocusedObject } from "@/lib/focus"
import { isOutstandingRequest, threadOwner } from "@/lib/threads"
import { cn } from "@/lib/utils"
import { getEffectiveRole, isClientRole, useRoleStore } from "@/stores/useRoleStore"
import { useThreadsStore } from "@/stores/useThreadsStore"
import { VisibilityToggle, type Visibility } from "./VisibilityToggle"

const EMPTY_MESSAGES: Message[] = []
const EMPTY_THREADS: Thread[] = []

/**
 * The anti-goal is a generic inbox: no global message list, no /messages route. A thread only
 * ever means something in relation to the object it's about, so this resolves its own scope
 * off the URL exactly the way ContextRail does, rather than taking one as a prop — mount it
 * anywhere a field or document is the current focus and it finds its own conversation.
 */
function scopeFromParams(
  params: Record<string, string | undefined>,
  searchParams: URLSearchParams
): { scope: ObjectRef; ret: Return } | null {
  const focus = resolveFocusedObject(params, searchParams)
  if (focus.kind === "field") return { scope: { type: "field", id: focus.field.id }, ret: focus.ret }
  if (focus.kind === "document") return { scope: { type: "document", id: focus.document.id }, ret: focus.ret }
  return null
}

function OwnerHeader({ thread }: { thread: Thread }) {
  const userId = useRoleStore((s) => s.userId)

  if (thread.resolvedAt !== null) {
    return (
      <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-state-verified-text">
        Resolved
      </span>
    )
  }
  const ownerId = threadOwner(thread)
  if (!ownerId) {
    return <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-ink/40">No reply pending</span>
  }
  const name = ownerId === userId ? "you" : (getUser(ownerId)?.name ?? ownerId)
  return (
    <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-state-needs-review-text">
      Waiting on {name}
    </span>
  )
}

function MessageRow({
  message,
  visibility,
  clientName,
}: {
  message: Message
  visibility: Thread["visibility"]
  clientName: string
}) {
  const author = getUser(message.authorId)?.name ?? message.authorId
  const isInternal = visibility === "internal"
  return (
    <div
      className={cn(
        "rounded-sm border p-2.5",
        isInternal ? "border-visibility-internal-border/40 bg-visibility-internal-fill/35" : "border-border bg-paper"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{author}</span>
        <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-ink/45">
          {format(new Date(message.sentAt), "MMM d, h:mm a")}
        </span>
      </div>
      <p className="mt-0.5 text-sm leading-relaxed">{message.body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {isInternal && (
          <span
            className={cn(
              "font-mono text-[0.625rem] font-semibold uppercase tracking-wide text-visibility-internal-text"
            )}
          >
            Internal — not visible to {clientName}
          </span>
        )}
        {message.isRequest && (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-ink/55">
            <HelpCircle className="size-3" aria-hidden="true" />
            Asked a question
          </span>
        )}
      </div>
    </div>
  )
}

function ThreadBlock({ thread, clientName }: { thread: Thread; clientName: string }) {
  const isInternal = thread.visibility === "internal"
  return (
    <div
      className={cn(
        "rounded-sm border p-3",
        isInternal ? "border-visibility-internal-border/35 bg-visibility-internal-fill/10" : "border-border"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono text-[0.625rem] uppercase tracking-wide",
            isInternal ? "text-visibility-internal-text" : "text-ink/50"
          )}
        >
          {isInternal ? "Internal" : `Visible to ${clientName}`}
        </span>
        <OwnerHeader thread={thread} />
      </div>
      <div className="space-y-2">
        {thread.messages.map((message) => (
          <MessageRow key={message.id} message={message} visibility={thread.visibility} clientName={clientName} />
        ))}
      </div>
    </div>
  )
}

interface ComposerProps {
  scope: ObjectRef
  ret: Return
  threads: Thread[]
  viewerRole: Role
  userId: string
  clientName: string
}

function Composer({ scope, ret, threads, viewerRole, userId, clientName }: ComposerProps) {
  const canChooseVisibility = !isClientRole(viewerRole)
  const [visibility, setVisibility] = useState<Visibility>(canChooseVisibility ? "internal" : "client-visible")
  const [body, setBody] = useState("")
  const [isRequest, setIsRequest] = useState(false)
  const postMessage = useThreadsStore((s) => s.postMessage)

  // Derived, not trusted to the stored `visibility` alone: the role switcher can flip a staff
  // viewer to a client one without remounting this component, and a client must never be able
  // to inherit a leftover "internal" selection from before the switch — not in what gets
  // posted, and not in the copy or tint the writer sees while composing.
  const effectiveVisibility: Visibility = canChooseVisibility ? visibility : "client-visible"
  const isInternal = effectiveVisibility === "internal"
  const preparerName = (ret.assignedTo && getUser(ret.assignedTo)?.name) || "your preparer"

  const existing = threads.find((t) => t.visibility === effectiveVisibility)

  function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    postMessage({
      scope,
      visibility: effectiveVisibility,
      existingThreadId: existing?.id ?? null,
      authorId: userId,
      body: trimmed,
      isRequest,
      otherParticipant: effectiveVisibility === "client-visible" ? ret.clientId : null,
    })
    setBody("")
    setIsRequest(false)
  }

  return (
    <div className="mt-3 space-y-2">
      {canChooseVisibility ? (
        <VisibilityToggle value={effectiveVisibility} onChange={setVisibility} clientName={clientName} />
      ) : (
        <p className="font-mono text-[0.625rem] uppercase tracking-wide text-ink/40">
          Visible to {preparerName}
        </p>
      )}
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          isInternal
            ? "Note for the team — never shown to the client…"
            : canChooseVisibility
              ? `Message to ${clientName}…`
              : `Reply to ${preparerName}…`
        }
        rows={3}
        className={cn(
          "w-full resize-none rounded-sm border p-2 text-sm outline-none transition-colors",
          isInternal
            ? "border-visibility-internal-border/50 bg-visibility-internal-fill/20 focus-visible:border-visibility-internal-border"
            : "border-border bg-paper focus-visible:border-ink/40"
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={isRequest}
          onClick={() => setIsRequest((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            isRequest
              ? "border-state-needs-review-border bg-state-needs-review-fill text-state-needs-review-text"
              : "border-border text-ink/50 hover:bg-panel"
          )}
        >
          <HelpCircle className="size-3.5" aria-hidden="true" />
          Needs a reply
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim()}
          className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-40"
        >
          Post
        </button>
      </div>
    </div>
  )
}

/**
 * Threads are always scoped to an object and render next to it — never a generic inbox. A
 * field or document can carry up to two parallel conversations, one per audience: the same
 * source can have an internal note questioning it and a client-visible question about it at
 * once, and both show here side by side rather than one hiding the other.
 */
export function ThreadPanel({ className }: { className?: string }) {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const userId = useRoleStore((s) => s.userId)
  const effectiveRole = getEffectiveRole(role, context)

  const postedMessages = useThreadsStore((s) => s.postedMessages)
  const newThreads = useThreadsStore((s) => s.newThreads)

  const resolved = scopeFromParams(params, searchParams)

  const threads = useMemo(() => {
    if (!resolved) return EMPTY_THREADS
    const { scope } = resolved
    const fixtureThreads = getThreadsForObject(scope, effectiveRole)
    const liveThreads = Object.values(newThreads).filter(
      (t) =>
        t.scope.type === scope.type &&
        t.scope.id === scope.id &&
        (!isClientRole(effectiveRole) || t.visibility === "client-visible")
    )
    return [...fixtureThreads, ...liveThreads]
      .map((t) => ({ ...t, messages: [...t.messages, ...(postedMessages[t.id] ?? EMPTY_MESSAGES)] }))
      .sort((a, b) => (a.visibility === b.visibility ? 0 : a.visibility === "client-visible" ? -1 : 1))
  }, [resolved, effectiveRole, newThreads, postedMessages])

  if (!resolved) return null
  const { ret } = resolved
  const clientName = getUser(ret.clientId)?.name ?? "the client"
  const hasOutstanding = threads.some(isOutstandingRequest)

  return (
    <div className={cn("border-t border-border pt-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest text-ink/60">
          <MessageSquareText className="size-3.5" aria-hidden="true" />
          Conversation
        </h2>
        {hasOutstanding && (
          <span className="font-mono text-[0.625rem] uppercase tracking-wide text-state-needs-review-text">
            Open question
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-ink/50">No conversation about this yet — start one below.</p>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <ThreadBlock key={thread.id} thread={thread} clientName={clientName} />
          ))}
        </div>
      )}

      <Composer
        scope={resolved.scope}
        ret={ret}
        threads={threads}
        viewerRole={effectiveRole}
        userId={userId}
        clientName={clientName}
      />
    </div>
  )
}

export default ThreadPanel
