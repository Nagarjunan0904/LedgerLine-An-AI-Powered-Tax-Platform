import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router"
import { AlertTriangle, ArrowRight } from "lucide-react"

import type { ReturnField } from "@/types"
import { getExtractedField, getFieldsForReturn, getProvenance, getReturn } from "@/data/fixtures"
import {
  chainRowId,
  collectDocuments,
  LOW_CONFIDENCE_THRESHOLD,
  traceField,
  type FieldNode,
} from "@/lib/provenance"
import { returnLabel } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { ProvenanceChain } from "@/components/provenance/ProvenanceChain"
import { ConnectorOverlay } from "@/components/provenance/ConnectorOverlay"
import { MockFormRenderer } from "@/components/documents/MockFormRenderer"
import { CorrectionFlow } from "@/components/ai/CorrectionFlow"
import { ExplainDrawer } from "@/components/ai/ExplainDrawer"
import { explainEvidenceId } from "@/components/ai/useCorrectionFlow"

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

/**
 * A reading order for the left pane: filing status first, then 1040 lines in numeric order,
 * then schedules, then anything else — not a claim of exact IRS form sequencing, just a
 * stable, sensible top-to-bottom order instead of fixture-generation order.
 */
function formLineSortKey(formLine: string): [number, string] {
  if (formLine === "1040-filing-status") return [-1, ""]
  const line1040 = /^1040-(\d+)([a-z]*)$/.exec(formLine)
  if (line1040) return [Number(line1040[1]), line1040[2]]
  const schedule = /^Sch\s+([A-Z])-(\d+)$/.exec(formLine)
  if (schedule) return [1000 + schedule[1].charCodeAt(0), schedule[2].padStart(4, "0")]
  return [9000, formLine]
}

function sortFields(fields: ReturnField[]): ReturnField[] {
  return [...fields].sort((a, b) => {
    const [aRank, aTie] = formLineSortKey(a.formLine)
    const [bRank, bTie] = formLineSortKey(b.formLine)
    return aRank - bRank || aTie.localeCompare(bTie)
  })
}

/** needs-review is always a problem to surface. ai-suggested only counts when the extraction
 * behind it is itself low-confidence — an ai-suggested field with a solid read isn't a
 * problem, it just hasn't been rubber-stamped yet. */
function needsAttention(field: ReturnField): boolean {
  if (field.state === "needs-review") return true
  if (field.state === "ai-suggested") {
    const prov = getProvenance(field.id)
    return prov ? prov.confidence < LOW_CONFIDENCE_THRESHOLD : false
  }
  return false
}

function fieldRowId(fieldId: string): string {
  return `field-row-${fieldId}`
}

function ShortcutHint() {
  const shortcuts: [string, string][] = [
    ["J/K", "Navigate"],
    ["Enter", "Edit"],
    ["E", "Explain"],
    ["Esc", "Close"],
  ]
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.625rem] uppercase tracking-wide text-ink/40">
      {shortcuts.map(([key, action]) => (
        <span key={key} className="inline-flex items-center gap-1">
          <kbd className="rounded-[2px] border border-ink/20 px-1 py-0.5 text-ink/60">{key}</kbd>
          {action}
        </span>
      ))}
    </p>
  )
}

function AttentionBanner({ count, onJump }: { count: number; onJump: () => void }) {
  if (count === 0) {
    return (
      <p className="rounded-sm border border-state-verified-border/40 bg-state-verified-fill/30 px-3 py-2 text-sm text-state-verified-text">
        Nothing needs review right now.
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={onJump}
      className="flex w-full items-center gap-2 rounded-sm border border-state-needs-review-border/60 bg-state-needs-review-fill/40 px-3 py-2 text-left text-sm font-medium text-state-needs-review-text hover:bg-state-needs-review-fill/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      {plural(count, "field")} need review
      <ArrowRight className="ml-auto size-4 shrink-0" aria-hidden="true" />
    </button>
  )
}

interface FieldRowProps {
  field: ReturnField
  isCursor: boolean
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onExplain: () => void
  onCommitted: () => void
}

/** Thin positional wrapper — id for scrollIntoView, the cursor/selection ring, click-to-
 * select. CorrectionFlow owns everything about the field itself (display, edit, audit,
 * marker). */
function FieldRow({ field, isCursor, isSelected, isEditing, onSelect, onExplain, onCommitted }: FieldRowProps) {
  return (
    <div
      id={fieldRowId(field.id)}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-sm p-1 outline-none transition-colors",
        isSelected && "bg-panel",
        isCursor && "ring-2 ring-ring"
      )}
    >
      <CorrectionFlow field={field} isEditing={isEditing} onExplain={onExplain} onCommitted={onCommitted} />
    </div>
  )
}

function CenterEmptyState({ flaggedCount, onJump }: { flaggedCount: number; onJump: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-16 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink/60">Select a field</p>
      <p className="max-w-xs text-sm text-ink/50">
        Choose a field on the left to see exactly where its value came from — the transform
        that produced it and every source that fed it.
      </p>
      {flaggedCount > 0 && (
        <button
          type="button"
          onClick={onJump}
          className="mt-1 text-sm font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
        >
          Start with the {flaggedCount === 1 ? "field" : `${flaggedCount} fields`} that need review
        </button>
      )}
    </div>
  )
}

function RightEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-16 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink/60">No document yet</p>
      <p className="max-w-xs text-sm text-ink/50">
        Once you select a field, its source document appears here with the exact region
        highlighted.
      </p>
    </div>
  )
}

/**
 * Three panes, all reflecting URL state: the return's fields (left), the selected field's
 * provenance chain (center), and its source documents with a connector drawn to whichever
 * source is selected (right). A cold load with ?field=, ?src=, and ?explain=open all set
 * restores everything — nothing here is client-only state that needs a separate hydration
 * step.
 */
export function ReturnReview() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const ret = id ? getReturn(id) : undefined

  const fields = useMemo(() => (ret ? sortFields(getFieldsForReturn(ret.id)) : []), [ret])
  const flaggedFields = useMemo(() => fields.filter(needsAttention), [fields])

  const fieldParam = searchParams.get("field")
  const srcParam = searchParams.get("src")
  const explainOpen = searchParams.get("explain") === "open"
  const selectedField = fieldParam ? fields.find((f) => f.formLine === fieldParam) : undefined

  // A cold load with ?field= already set should start the keyboard cursor there too, not at
  // index 0 — otherwise j/k's first move would jump away from whatever the URL just restored.
  const [cursorIndex, setCursorIndex] = useState(() => {
    if (!fieldParam) return 0
    const index = fields.findIndex((f) => f.formLine === fieldParam)
    return index >= 0 ? index : 0
  })
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const selectedChain: FieldNode | null = useMemo(
    () => (selectedField ? traceField(selectedField.id) : null),
    [selectedField]
  )
  const selectedDocuments = useMemo(() => (selectedChain ? collectDocuments(selectedChain) : []), [selectedChain])

  function selectField(formLine: string) {
    const next = new URLSearchParams(searchParams)
    next.set("field", formLine)
    next.delete("src")
    setSearchParams(next)
    setEditingFieldId(null)
  }

  /** E / FieldBox's Explain affordance: select the field AND open the drawer in one URL
   * update — both triggers land here. */
  function explainField(formLine: string) {
    const next = new URLSearchParams(searchParams)
    next.set("field", formLine)
    next.delete("src")
    next.set("explain", "open")
    setSearchParams(next)
    setEditingFieldId(null)
    const index = fields.findIndex((f) => f.formLine === formLine)
    if (index >= 0) setCursorIndex(index)
  }

  function closePanels() {
    const next = new URLSearchParams(searchParams)
    next.delete("field")
    next.delete("src")
    next.delete("explain")
    setSearchParams(next)
    setEditingFieldId(null)
  }

  function jumpToFirstFlagged() {
    const first = flaggedFields[0]
    if (!first) return
    const index = fields.findIndex((f) => f.id === first.id)
    if (index >= 0) setCursorIndex(index)
    selectField(first.formLine)
    document.getElementById(fieldRowId(first.id))?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  // Intentionally no dependency array: this re-subscribes every render so the handler always
  // closes over the latest searchParams/fields/cursorIndex — cheap for a keydown listener, and
  // the alternative (memoizing with a dependency list) risks a stale searchParams reference
  // dropping a just-set ?src= when j/k/e updates the URL next.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (event.key === "Escape") {
        closePanels()
        return
      }
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      if (isTyping || fields.length === 0) return
      if (event.key === "j") {
        event.preventDefault()
        setCursorIndex((i) => Math.min(i + 1, fields.length - 1))
      } else if (event.key === "k") {
        event.preventDefault()
        setCursorIndex((i) => Math.max(i - 1, 0))
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault()
        const field = fields[cursorIndex]
        if (field) explainField(field.formLine)
      } else if (event.key === "Enter") {
        event.preventDefault()
        const field = fields[cursorIndex]
        if (field) {
          selectField(field.formLine)
          setEditingFieldId(field.id)
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  })

  if (!ret) {
    return (
      <main className="p-10">
        <p className="text-sm text-ink/60">No return found.</p>
      </main>
    )
  }

  const connectorTone = (() => {
    if (!srcParam) return "neutral" as const
    const extracted = getExtractedField(srcParam)
    return extracted && extracted.confidence < LOW_CONFIDENCE_THRESHOLD ? ("flagged" as const) : ("neutral" as const)
  })()
  // Two possible connector origins share the same ?src= — the chain row in the center pane,
  // or an evidence chip in the drawer — whichever is actually on screen right now.
  const connectorFromId = srcParam ? (explainOpen ? explainEvidenceId(srcParam) : chainRowId(srcParam)) : null

  return (
    <div className="grid grid-cols-1 items-start gap-6 p-6 lg:grid-cols-[18rem_24rem_minmax(28rem,1fr)]">
      <section className="flex flex-col gap-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2">
        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-ink/50">{returnLabel(ret)}</p>
          <h1 className="font-display text-lg font-bold uppercase tracking-wide">Return review</h1>
        </header>
        <ShortcutHint />
        <AttentionBanner count={flaggedFields.length} onJump={jumpToFirstFlagged} />
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <FieldRow
              key={field.id}
              field={field}
              isCursor={index === cursorIndex}
              isSelected={selectedField?.id === field.id}
              isEditing={editingFieldId === field.id}
              onSelect={() => {
                setCursorIndex(index)
                selectField(field.formLine)
              }}
              onExplain={() => explainField(field.formLine)}
              onCommitted={() => setEditingFieldId(null)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-border p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        {selectedField ? (
          <ProvenanceChain fieldId={selectedField.id} />
        ) : (
          <CenterEmptyState flaggedCount={flaggedFields.length} onJump={jumpToFirstFlagged} />
        )}
      </section>

      <section className="rounded-sm border border-border bg-panel/30 p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        {!selectedField ? (
          <RightEmptyState />
        ) : selectedDocuments.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {selectedDocuments.map((doc) => (
              <MockFormRenderer key={doc.id} document={doc} highlightId={srcParam ?? undefined} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/50">
            {selectedChain?.provenance?.method === "client-entered"
              ? "This value was entered manually — there's no source document to show."
              : "This value has no source document to show."}
          </p>
        )}
      </section>

      <ExplainDrawer fieldId={selectedField?.id ?? null} />
      {srcParam && connectorFromId && <ConnectorOverlay fromId={connectorFromId} toId={srcParam} tone={connectorTone} />}
    </div>
  )
}

export default ReturnReview
