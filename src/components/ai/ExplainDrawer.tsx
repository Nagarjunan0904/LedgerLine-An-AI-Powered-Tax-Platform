import { useEffect, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react"
import { useSearchParams } from "react-router"
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, RotateCcw, UserCheck, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { EvidenceRef, Explanation } from "@/services/ai"
import { AIServiceError, aiService } from "@/services/ai"
import type { ExtractedField } from "@/types"
import { getExtractedField } from "@/data/fixtures"
import { cn } from "@/lib/utils"
import { ConfidenceBadge } from "./ConfidenceBadge"
import { explainEvidenceId, useCorrectExtracted, useEffectiveExtracted } from "./useCorrectionFlow"

export interface ExplainDrawerProps {
  /** The ReturnField currently being explained. Null means nothing is selected — the drawer
   * just won't be able to open even if ?explain=open is somehow set. */
  fieldId: string | null
}

const ACTION_COPY: Record<Explanation["recommendedAction"], { label: string; icon: LucideIcon; className: string }> = {
  accept: { label: "Safe to accept", icon: CheckCircle2, className: "text-state-verified-text" },
  review: { label: "Worth a look", icon: Eye, className: "text-state-ai-suggested-text" },
  "needs-human": { label: "Needs a human", icon: AlertTriangle, className: "text-state-needs-review-text" },
}

function RecommendedAction({ action }: { action: Explanation["recommendedAction"] }) {
  const copy = ACTION_COPY[action]
  const Icon = copy.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", copy.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {copy.label}
    </span>
  )
}

function ExplainSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-3.5 w-full rounded-sm bg-panel" />
        <div className="h-3.5 w-2/3 rounded-sm bg-panel" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-32 rounded-full bg-panel" />
        <div className="h-4 w-24 rounded-sm bg-panel" />
      </div>
      <div className="h-px w-full bg-border" />
      <div className="h-3.5 w-28 rounded-sm bg-panel" />
    </div>
  )
}

function ExplainError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-sm border border-state-needs-review-border/60 bg-state-needs-review-fill/40 p-3">
      <p className="text-sm text-state-needs-review-text">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-state-needs-review-text underline decoration-current/40 underline-offset-2 hover:decoration-current"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}

/**
 * One evidence chip. The row itself selects the source (?src=, driving the highlight and the
 * connector); a separate control edits its value — "correcting a W-2 source" happens right
 * here, inline, no modal, using the exact same correction store a ReturnField edit does.
 */
function EvidenceRow({
  evidenceRef,
  extracted,
  isSelected,
  onSelect,
}: {
  evidenceRef: EvidenceRef
  extracted: ExtractedField
  isSelected: boolean
  onSelect: () => void
}) {
  const effective = useEffectiveExtracted(extracted)
  const correctExtracted = useCorrectExtracted()
  const [isEditingValue, setIsEditingValue] = useState(false)
  const [draft, setDraft] = useState("")

  function beginEdit(event: ReactMouseEvent) {
    event.stopPropagation()
    setDraft(effective.value)
    setIsEditingValue(true)
  }
  function commit() {
    correctExtracted(extracted, draft, effective.value)
    setIsEditingValue(false)
  }
  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit()
    if (event.key === "Escape") setIsEditingValue(false)
  }

  return (
    <div
      id={explainEvidenceId(evidenceRef.extractedFieldId)}
      className={cn(
        "flex items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 text-sm",
        isSelected && "bg-panel ring-1 ring-ink/25"
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:underline">
        <span className="truncate">{evidenceRef.label}</span>
        {effective.isCorrected && (
          <UserCheck
            className="size-3 shrink-0 text-state-verified-text"
            aria-label={`Corrected — original: ${effective.originalValue}`}
          />
        )}
      </button>
      {isEditingValue ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsEditingValue(false)}
          className="w-24 rounded-sm border border-ink/30 bg-transparent px-1 py-0.5 text-right font-mono text-sm tabular-nums outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={beginEdit}
          title={effective.isCorrected ? `Original: ${effective.originalValue} — click to correct again` : "Click to correct this value"}
          className="shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-sm tabular-nums hover:bg-panel"
        >
          {effective.value}
        </button>
      )}
    </div>
  )
}

function ExplainContent({ explanation }: { explanation: Explanation }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const srcParam = searchParams.get("src")
  const [evidenceOpen, setEvidenceOpen] = useState(() => Boolean(searchParams.get("src")))
  const [detailOpen, setDetailOpen] = useState(false)

  const resolvedEvidence = explanation.evidence
    .map((ref) => ({ ref, extracted: getExtractedField(ref.extractedFieldId) }))
    .filter((entry): entry is { ref: EvidenceRef; extracted: ExtractedField } => entry.extracted !== undefined)

  function selectSource(extractedFieldId: string) {
    const next = new URLSearchParams(searchParams)
    if (next.get("src") === extractedFieldId) next.delete("src")
    else next.set("src", extractedFieldId)
    setSearchParams(next, { replace: true })
  }

  const hasDetail = Boolean(explanation.uncertaintyReason) || Boolean(explanation.alternativesConsidered?.length)

  return (
    <div className="space-y-4">
      {/* Tier 1 — always visible */}
      <div>
        <p className="text-sm leading-relaxed">{explanation.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={explanation.confidence} />
          <RecommendedAction action={explanation.recommendedAction} />
        </div>
      </div>

      {/* Tier 2 — one click */}
      {resolvedEvidence.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setEvidenceOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left font-mono text-xs uppercase tracking-wide text-ink/50"
          >
            Evidence ({resolvedEvidence.length})
            <ChevronDown className={cn("size-3.5 transition-transform", evidenceOpen && "rotate-180")} aria-hidden="true" />
          </button>
          {evidenceOpen && (
            <div className="mt-2 space-y-1.5">
              {resolvedEvidence.map(({ ref, extracted }) => (
                <EvidenceRow
                  key={ref.extractedFieldId}
                  evidenceRef={ref}
                  extracted={extracted}
                  isSelected={srcParam === ref.extractedFieldId}
                  onSelect={() => selectSource(ref.extractedFieldId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tier 3 — one more click */}
      {hasDetail && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left font-mono text-xs uppercase tracking-wide text-ink/50"
          >
            Why the uncertainty?
            <ChevronDown className={cn("size-3.5 transition-transform", detailOpen && "rotate-180")} aria-hidden="true" />
          </button>
          {detailOpen && (
            <div className="mt-2 space-y-2">
              {explanation.uncertaintyReason && <p className="text-sm text-ink/70">{explanation.uncertaintyReason}</p>}
              {explanation.alternativesConsidered && explanation.alternativesConsidered.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[0.625rem] uppercase tracking-wide text-ink/40">Also considered</p>
                  <ul className="space-y-1">
                    {explanation.alternativesConsidered.map((alt, i) => (
                      <li key={i} className="flex items-center justify-between font-mono text-xs tabular-nums text-ink/70">
                        <span>{alt.value}</span>
                        <span className="opacity-60">{Math.round(alt.confidence * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Answers the trust brief's six questions in a deliberate hierarchy, not all at once: what it
 * did / confidence / recommended action are always visible; evidence is one click away;
 * uncertainty detail and alternatives are one click past that. Opens from the E shortcut and
 * FieldBox's Explain affordance (both drive ?explain=open via ReturnReview); state lives in
 * the URL so it deep-links and survives a cold load.
 */
export function ExplainDrawer({ fieldId }: ExplainDrawerProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isOpen = searchParams.get("explain") === "open" && fieldId !== null

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!isOpen || !fieldId) return
    let cancelled = false
    // The "loading" transition (and the fetch itself) is deferred into a microtask rather
    // than called synchronously in the effect body — same reasoning as ConnectorOverlay's
    // rAF deferral: setState belongs in a callback, not the effect's own direct execution.
    Promise.resolve().then(async () => {
      if (cancelled) return
      setStatus("loading")
      try {
        const result = await aiService.explainField(fieldId)
        if (!cancelled) {
          setExplanation(result)
          setStatus("ready")
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof AIServiceError ? err.message : "The explain service failed unexpectedly.")
          setStatus("error")
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, fieldId, retryToken])

  function close() {
    const next = new URLSearchParams(searchParams)
    next.delete("explain")
    setSearchParams(next)
  }

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-full max-w-sm flex-col border-r border-border bg-paper shadow-lg transition-transform duration-200",
        isOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-ink/60">Explain</p>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="rounded-sm p-1 text-ink/50 hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {status === "loading" && <ExplainSkeleton />}
        {status === "error" && errorMessage && (
          <ExplainError message={errorMessage} onRetry={() => setRetryToken((t) => t + 1)} />
        )}
        {status === "ready" && explanation && <ExplainContent explanation={explanation} />}
      </div>
    </aside>
  )
}

export default ExplainDrawer
