import { useMemo, useRef } from "react"
import type { ChangeEvent } from "react"
import { Link } from "react-router"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Activity, ArrowRight, ClipboardList, FileText, Upload } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { format } from "date-fns"

import type { Document, OpenItem, Return } from "@/types"
import { getDocumentsForReturn, getFieldsForReturn, getOpenItemsForReturn, getReturnsForUser } from "@/data/fixtures"
import { getEffectiveRole, useRoleStore } from "@/stores/useRoleStore"
import { useDocumentUploadsStore } from "@/stores/useDocumentUploadsStore"
import { getNextClientTask, getOnboardingStage, type ClientTask, type OnboardingStage } from "@/lib/prioritize"
import { CLIENT_PHASES, getNextAction } from "@/lib/status"
import { cn } from "@/lib/utils"
import { ClientPhaseBar } from "@/components/status/ClientPhaseBar"
import { FieldBox } from "@/components/field/FieldBox"

const STAGE_TRANSITION = { duration: 0.28, ease: [0.16, 1, 0.3, 1] } as const

/** A stable fallback for the "no uploads yet" case. The Zustand selector below must return
 * either the raw stored slice or this same reference every time — never a fresh `[] ` — or
 * the store looks changed on every render and React loops ("Maximum update depth exceeded"). */
const EMPTY_DOCUMENTS: Document[] = []

/** A client with more than one tax year (Marcus Ellery: 2025 and 2026) sees the most recent
 * one on their home page — that's the return they're currently living through. */
function pickReturn(returns: Return[]): Return | undefined {
  return [...returns].sort((a, b) => b.taxYear - a.taxYear)[0]
}

function OverviewTile({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: LucideIcon
  label: string
  value: string
  /** Absent means this tile is deferred — rendered inert rather than omitted, so the shape
   * of the product is visible before it's usable. */
  to?: string
}) {
  const className = cn(
    "flex items-start gap-2.5 rounded-sm border border-border p-3",
    to ? "hover:bg-panel" : "opacity-50"
  )
  const content = (
    <>
      <Icon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-mono text-[0.6875rem] uppercase tracking-wide opacity-60">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
      </div>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <div className={className} aria-disabled="true">
      {content}
    </div>
  )
}

function NewStage({ processing, onUpload }: { processing: boolean; onUpload: () => void }) {
  return (
    <div>
      <div className="rounded-sm border border-ink/20 bg-panel/40 p-6">
        <p className="font-display text-sm font-semibold uppercase tracking-wide">Upload your W-2</p>
        <p className="mt-2 max-w-prose text-sm text-ink/70">
          We need at least one income document before we can start preparing your return.
        </p>
        <button
          type="button"
          onClick={onUpload}
          disabled={processing}
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-sm border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            processing ? "cursor-not-allowed opacity-60" : "hover:opacity-90"
          )}
        >
          <Upload className="size-4" aria-hidden="true" />
          {processing ? "Uploading…" : "Upload W-2"}
        </button>
      </div>

      <div className="mt-8" role="group" aria-label="Available after you upload your first document">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <OverviewTile icon={Activity} label="Progress" value="—" />
          <OverviewTile icon={FileText} label="Documents" value="—" />
          <OverviewTile icon={ClipboardList} label="Open items" value="—" />
        </div>
        <p className="mt-3 text-xs text-ink/50">Available after you upload your first document.</p>
      </div>
    </div>
  )
}

function InProgressStage({
  ret,
  nextTask,
  openItems,
}: {
  ret: Return
  nextTask: ClientTask | null
  openItems: OpenItem[]
}) {
  const nextAction = getNextAction(ret)

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-ink/20 bg-panel/40 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/50">Next up</p>
        {nextTask ? (
          <>
            <p className="mt-1 font-medium">{nextTask.title}</p>
            <p className="mt-1 text-sm text-ink/70">{nextTask.description}</p>
            {nextTask.dueDate && (
              <p className="mt-2 text-xs text-ink/50">
                Due {format(new Date(nextTask.dueDate), "MMM d, yyyy")}
              </p>
            )}
            <Link
              to={nextTask.to}
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
            >
              Review
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 font-medium">Nothing needed from you right now</p>
            <p className="mt-1 text-sm text-ink/70">{nextAction.description}</p>
          </>
        )}
      </div>

      <ClientPhaseBar ret={ret} compact />

      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink/50 mb-2">
          Open items{openItems.length > 0 ? ` (${openItems.length})` : ""}
        </p>
        {openItems.length === 0 ? (
          <p className="text-sm text-ink/50">No open items.</p>
        ) : (
          <ul className="space-y-2">
            {openItems.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/returns/${ret.id}/items?item=${item.id}`}
                  className="block rounded-sm border border-border p-3 hover:bg-panel"
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink/60">{item.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CompleteStage({
  ret,
  documents,
  openItems,
}: {
  ret: Return
  documents: Document[]
  openItems: OpenItem[]
}) {
  const fields = getFieldsForReturn(ret.id)
  const phase = CLIENT_PHASES.find((p) => p.phase === ret.clientPhase)!

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-ink/20 bg-panel/40 p-6">
        <p className="font-display text-sm font-semibold uppercase tracking-wide">{phase.label}</p>
        <p className="mt-1 text-sm text-ink/70">{phase.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <OverviewTile icon={Activity} label="Progress" value={phase.label} to={`/returns/${ret.id}`} />
        <OverviewTile
          icon={FileText}
          label="Documents"
          value={`${documents.length} uploaded`}
          to={`/returns/${ret.id}/documents`}
        />
        <OverviewTile
          icon={ClipboardList}
          label="Open items"
          value={openItems.length === 0 ? "None" : `${openItems.length} open`}
          to={`/returns/${ret.id}/items`}
        />
      </div>

      {fields.length > 0 && (
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ink/50 mb-2">Your numbers</p>
          <div className="flex flex-wrap gap-3">
            {fields.map((field) => (
              <FieldBox key={field.id} state={field.state} label={field.label} value={field.value} size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClientHomeForReturn({ ret, userId }: { ret: Return; userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const extraDocuments = useDocumentUploadsStore((s) => s.uploadedByReturn[ret.id]) ?? EMPTY_DOCUMENTS
  const processing = useDocumentUploadsStore((s) => s.processingReturnId === ret.id)
  const upload = useDocumentUploadsStore((s) => s.upload)

  const documents: Document[] = useMemo(
    () => [...getDocumentsForReturn(ret.id), ...extraDocuments],
    [ret.id, extraDocuments]
  )
  const stage: OnboardingStage = getOnboardingStage(ret, documents)
  const openItems = getOpenItemsForReturn(ret.id).filter((i) => i.resolvedAt === null)
  const nextTask = getNextClientTask(ret)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || processing) return
    upload(ret.id, "W-2", file.name, userId)
  }

  return (
    <main className="mx-auto max-w-3xl p-10">
      <header className="mb-8">
        <p className="font-display text-xs uppercase tracking-widest text-ink/60">Your return</p>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">
          {ret.taxYear} tax return
        </h1>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="sr-only"
        onChange={handleFileChange}
        disabled={processing}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={STAGE_TRANSITION}
        >
          {stage === "new" && (
            <NewStage processing={processing} onUpload={() => inputRef.current?.click()} />
          )}
          {stage === "in-progress" && (
            <InProgressStage ret={ret} nextTask={nextTask} openItems={openItems} />
          )}
          {stage === "complete" && (
            <CompleteStage ret={ret} documents={documents} openItems={openItems} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}

/**
 * /home for client roles. Which of the three onboarding states renders is computed fresh on
 * every render from fixture data plus useDocumentUploadsStore's in-memory uploads — never a
 * toggle. StaffState is never imported here; the only status vocabulary this page speaks is
 * ClientPhase (via ClientPhaseBar) and the plain OnboardingStage above.
 */
export function ClientHome() {
  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const userId = useRoleStore((s) => s.userId)
  const effectiveRole = getEffectiveRole(role, context)

  const ret = pickReturn(getReturnsForUser(userId, effectiveRole))

  if (!ret) {
    return (
      <main className="p-10">
        <p className="text-sm text-ink/70">No return is on file yet.</p>
      </main>
    )
  }

  return <ClientHomeForReturn ret={ret} userId={userId} />
}

export default ClientHome
