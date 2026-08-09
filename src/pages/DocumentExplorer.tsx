import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useParams, useSearchParams } from "react-router"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowRight, ChevronRight, HelpCircle, X } from "lucide-react"

import type { Document, DocumentType, ExtractionStatus, Return } from "@/types"
import { getDocuments, getDocumentsForReturn, getExtractedFieldsForDocument, getReturn, getReturnsForUser, getUser } from "@/data/fixtures"
import {
  buildSearchRecords,
  createDocumentSearchIndex,
  EXTRACTION_STATUS_LABEL,
  CONFIDENCE_BAND_LABEL,
  DOCUMENT_TYPES,
  EXTRACTION_STATUSES,
  CONFIDENCE_BANDS,
  groupRecords,
  hasActiveFilters,
  matchesFilters,
  searchDocuments,
  type ConfidenceBand,
  type DocumentFilters,
  type DocumentGroup,
  type DocumentSearchRecord,
  type GroupBy,
} from "@/lib/search"
import { documentLabel, parseBoxLabel, returnLabel, shortFieldLabel } from "@/lib/labels"
import { fieldsSourcedFrom } from "@/lib/provenance"
import { cn } from "@/lib/utils"
import { getEffectiveRole, isClientRole, useRoleStore } from "@/stores/useRoleStore"
import { FieldBox } from "@/components/field/FieldBox"
import { ConfidenceBadge } from "@/components/ai/ConfidenceBadge"

const GROUP_HEADER_HEIGHT = 34
const ROW_HEIGHT_ESTIMATE = 52

// Scroll position is imperative bookkeeping, not app state — a plain module-level map (keyed
// by the exact URL, so different filter views each remember their own place) survives this
// component unmounting when the user navigates into a document and back, the same way
// ConnectorOverlay keeps its own per-frame position outside React state.
const scrollMemory = new Map<string, number>()

type ListRow = { kind: "header"; group: DocumentGroup } | { kind: "record"; record: DocumentSearchRecord }

function flattenGroups(groups: DocumentGroup[]): ListRow[] {
  const rows: ListRow[] = []
  for (const group of groups) {
    rows.push({ kind: "header", group })
    for (const record of group.records) rows.push({ kind: "record", record })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Chrome: scope toggle, group-by toggle, search box, filter pills, chips
// ---------------------------------------------------------------------------

function ScopeToggle({ search }: { search: string }) {
  return (
    <div role="group" aria-label="Document scope" className="flex rounded-sm border border-border p-0.5 text-sm">
      <span className="rounded-[2px] bg-ink px-2.5 py-1 font-medium text-paper">This return</span>
      <Link
        to={`/documents${search}`}
        className="rounded-[2px] px-2.5 py-1 font-medium opacity-60 hover:opacity-100"
      >
        All documents
      </Link>
    </div>
  )
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "type", label: "By type" },
  { value: "status", label: "By status" },
  { value: "upload-date", label: "By upload date" },
]

function GroupByToggle({ value, onChange }: { value: GroupBy; onChange: (v: GroupBy) => void }) {
  return (
    <div role="radiogroup" aria-label="Group documents" className="flex rounded-sm border border-border p-0.5 text-sm">
      {GROUP_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[2px] px-2.5 py-1 font-medium",
            value === opt.value ? "bg-ink text-paper" : "opacity-60 hover:opacity-100"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function FilterPillGroup<T extends string>({
  label,
  options,
  optionLabel,
  active,
  onToggle,
}: {
  label: string
  options: T[]
  optionLabel: (opt: T) => string
  active: T[]
  onToggle: (opt: T) => void
}) {
  if (options.length === 0) return null
  return (
    <div>
      <p className="mb-1 font-mono text-[0.625rem] uppercase tracking-wide text-ink/40">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = active.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggle(opt)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isActive ? "border-ink bg-ink text-paper" : "border-border text-ink/60 hover:bg-panel"
              )}
            >
              {optionLabel(opt)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface Chip {
  key: string
  label: string
  onRemove: () => void
}

function ChipRow({ chips }: { chips: Chip[] }) {
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-panel px-2 py-0.5 text-xs font-medium hover:bg-panel/70"
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function EmptyState({
  query,
  filtersActive,
  onClear,
}: {
  query: string
  filtersActive: boolean
  onClear: () => void
}) {
  const parts: string[] = []
  if (query) parts.push(`your search for "${query}"`)
  if (filtersActive) parts.push("your filters")
  const what = parts.length > 0 ? parts.join(" and ") : "the current view"
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink/60">No documents match</p>
      <p className="max-w-sm text-sm text-ink/50">Nothing matches {what}.</p>
      {(query || filtersActive) && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-sm font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
        >
          Clear search and filters
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows — level 1 (collapsed) and level 2 (expanded in place)
// ---------------------------------------------------------------------------

function ExtractedFieldSummary({ document: doc }: { document: Document }) {
  const extracted = getExtractedFieldsForDocument(doc.id)
  if (extracted.length === 0) {
    return <p className="text-sm text-ink/50">No fields were extracted from this document.</p>
  }
  return (
    <div className="space-y-3">
      {extracted.map((ext) => {
        const linkedFields = fieldsSourcedFrom(ext.id, doc.returnId)
        const box = parseBoxLabel(ext.label)
        const state = linkedFields[0]?.state ?? "ai-suggested"
        return (
          <div key={ext.id} className="space-y-1.5">
            <FieldBox
              state={state}
              label={box.description || ext.label}
              value={ext.rawValue}
              size="sm"
              confidence={state === "ai-suggested" ? ext.confidence : undefined}
            />
            {linkedFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-1">
                <span className="font-mono text-[0.625rem] uppercase tracking-wide text-ink/40">Feeds</span>
                {linkedFields.map((field) => (
                  <Link
                    key={field.id}
                    to={`/returns/${field.returnId}/review?field=${encodeURIComponent(field.formLine)}`}
                    className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-panel"
                  >
                    {shortFieldLabel(field)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ExpandedDetail({ document: doc }: { document: Document }) {
  return (
    <div className="border-t border-border bg-panel/20 py-3 pl-9 pr-3">
      <ExtractedFieldSummary document={doc} />
      <Link
        to={`/returns/${doc.returnId}/documents/${doc.id}`}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
      >
        Open full document
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  )
}

function DocumentRow({
  record,
  showReturnLabel,
  expanded,
  onToggle,
}: {
  record: DocumentSearchRecord
  showReturnLabel: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const { document: doc } = record
  const ret = showReturnLabel ? getReturn(doc.returnId) : undefined

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-panel/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 text-ink/40 transition-transform", expanded && "rotate-90")}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{documentLabel(doc)}</p>
          {ret && <p className="truncate text-xs text-ink/45">{returnLabel(ret)}</p>}
        </div>
        <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-wide text-ink/50">
          {EXTRACTION_STATUS_LABEL[doc.extractionStatus]}
        </span>
        {record.confidence !== null ? (
          <ConfidenceBadge confidence={record.confidence} />
        ) : (
          <span className="shrink-0 font-mono text-[0.6875rem] text-ink/35">No extraction</span>
        )}
        {record.hasOpenQuestions && (
          <HelpCircle className="size-3.5 shrink-0 text-state-needs-review-text" aria-label="Has an open question" />
        )}
      </button>
      {expanded && <ExpandedDetail document={doc} />}
    </div>
  )
}

function GroupHeaderRow({ group }: { group: DocumentGroup }) {
  return (
    <div className="flex h-full items-center gap-2 border-b border-border bg-panel/60 px-3">
      <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-wide text-ink/60">{group.label}</p>
      <span className="font-mono text-[0.6875rem] tabular-nums text-ink/40">{group.records.length}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The virtualized, grouped list
// ---------------------------------------------------------------------------

function DocumentList({
  rows,
  showReturnLabel,
  scrollKey,
}: {
  rows: ListRow[]
  showReturnLabel: boolean
  scrollKey: string
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index].kind === "header" ? GROUP_HEADER_HEIGHT : ROW_HEIGHT_ESTIMATE),
    overscan: 8,
  })

  // Restores scroll position on mount (a return trip from the full document view) and keeps
  // it saved as the user scrolls — see scrollMemory's own comment for why this isn't state.
  useLayoutEffect(() => {
    const saved = scrollMemory.get(scrollKey)
    if (saved && parentRef.current) {
      parentRef.current.scrollTop = saved
    }
  }, [scrollKey])

  function toggleExpanded(docId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  return (
    <div
      ref={parentRef}
      onScroll={(event) => scrollMemory.set(scrollKey, event.currentTarget.scrollTop)}
      className="h-[calc(100vh-20rem)] min-h-[24rem] overflow-y-auto rounded-sm border border-border"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          return (
            <div
              key={row.kind === "header" ? row.group.key : row.record.document.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
            >
              {row.kind === "header" ? (
                <GroupHeaderRow group={row.group} />
              ) : (
                <DocumentRow
                  record={row.record}
                  showReturnLabel={showReturnLabel}
                  expanded={expandedIds.has(row.record.document.id)}
                  onToggle={() => toggleExpanded(row.record.document.id)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function scopeInfo(
  isClient: boolean,
  routeReturnId: string | undefined,
  userId: string,
  effectiveRole: ReturnType<typeof getEffectiveRole>
): { ret: Return | undefined; documents: Document[]; scopeLabel: string; isFirmWide: boolean } {
  if (isClient) {
    const ret = getReturnsForUser(userId, effectiveRole)[0]
    return { ret, documents: ret ? getDocumentsForReturn(ret.id) : [], scopeLabel: ret ? returnLabel(ret) : "No return", isFirmWide: false }
  }
  if (!routeReturnId) {
    return { ret: undefined, documents: getDocuments(), scopeLabel: "All documents", isFirmWide: true }
  }
  const ret = getReturn(routeReturnId)
  return { ret, documents: ret ? getDocumentsForReturn(ret.id) : [], scopeLabel: ret ? returnLabel(ret) : "Return not found", isFirmWide: false }
}

/**
 * Every document, searchable and filterable — either one return's ~11 or the whole firm's
 * 420, depending on scope. Fuzzy search plus composable filters plus a group-by toggle, all
 * living in the URL so a filtered view is shareable. Level 1→2 (row → expanded detail) never
 * navigates away; only opening the full document (level 3) does.
 */
export function DocumentExplorer() {
  const params = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const userId = useRoleStore((s) => s.userId)
  const effectiveRole = getEffectiveRole(role, context)
  const isClient = isClientRole(effectiveRole)

  const { ret, documents, scopeLabel, isFirmWide } = scopeInfo(isClient, params.id, userId, effectiveRole)

  const query = searchParams.get("q") ?? ""
  const groupBy = (searchParams.get("group") as GroupBy | null) ?? "type"
  const filters: DocumentFilters = useMemo(
    () => ({
      types: searchParams.getAll("type") as DocumentType[],
      statuses: searchParams.getAll("status") as ExtractionStatus[],
      confidenceBands: searchParams.getAll("confidence") as ConfidenceBand[],
      hasOpenQuestions: searchParams.get("open") === "1",
      uploadedBy: searchParams.getAll("uploader"),
    }),
    [searchParams]
  )

  const records = useMemo(() => buildSearchRecords(documents), [documents])
  const searchIndex = useMemo(() => createDocumentSearchIndex(records), [records])
  const searched = useMemo(() => searchDocuments(searchIndex, records, query), [searchIndex, records, query])
  const filtered = useMemo(() => searched.filter((r) => matchesFilters(r, filters)), [searched, filters])
  const groups = useMemo(() => groupRecords(filtered, groupBy), [filtered, groupBy])
  const rows = useMemo(() => flattenGroups(groups), [groups])

  const presentTypes = useMemo(
    () => DOCUMENT_TYPES.filter((t) => searched.some((r) => r.document.type === t)),
    [searched]
  )
  const presentStatuses = useMemo(
    () => EXTRACTION_STATUSES.filter((s) => searched.some((r) => r.document.extractionStatus === s)),
    [searched]
  )
  const presentBands = useMemo(
    () => CONFIDENCE_BANDS.filter((b) => searched.some((r) => r.confidenceBand === b)),
    [searched]
  )
  const presentUploaders = useMemo(() => {
    const seen = new Map<string, string>()
    for (const record of searched) {
      const id = record.document.uploadedBy
      if (!seen.has(id)) seen.set(id, getUser(id)?.name ?? id)
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [searched])

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  function setQuery(value: string) {
    updateParams((next) => (value ? next.set("q", value) : next.delete("q")))
  }
  function setGroup(value: GroupBy) {
    updateParams((next) => next.set("group", value))
  }
  function toggleMulti(key: string, value: string) {
    updateParams((next) => {
      const current = next.getAll(key)
      next.delete(key)
      const nextValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      nextValues.forEach((v) => next.append(key, v))
    })
  }
  function toggleOpenQuestions() {
    updateParams((next) => (next.get("open") === "1" ? next.delete("open") : next.set("open", "1")))
  }
  function clearAll() {
    updateParams((next) => {
      for (const key of ["q", "type", "status", "confidence", "open", "uploader"]) next.delete(key)
    })
  }

  // Cheap enough (a handful of chip objects) to build directly in the render body rather than
  // memoize — no useMemo dependency-array to keep in sync with the toggle*/setQuery closures
  // it reads.
  const chips: Chip[] = []
  if (query) chips.push({ key: "q", label: `Search: "${query}"`, onRemove: () => setQuery("") })
  for (const type of filters.types) {
    chips.push({ key: `type-${type}`, label: `Type: ${type}`, onRemove: () => toggleMulti("type", type) })
  }
  for (const status of filters.statuses) {
    chips.push({
      key: `status-${status}`,
      label: `Status: ${EXTRACTION_STATUS_LABEL[status]}`,
      onRemove: () => toggleMulti("status", status),
    })
  }
  for (const band of filters.confidenceBands) {
    chips.push({
      key: `confidence-${band}`,
      label: CONFIDENCE_BAND_LABEL[band],
      onRemove: () => toggleMulti("confidence", band),
    })
  }
  if (filters.hasOpenQuestions) {
    chips.push({ key: "open", label: "Has open question", onRemove: toggleOpenQuestions })
  }
  for (const uploaderId of filters.uploadedBy) {
    chips.push({
      key: `uploader-${uploaderId}`,
      label: `Uploaded by ${getUser(uploaderId)?.name ?? uploaderId}`,
      onRemove: () => toggleMulti("uploader", uploaderId),
    })
  }

  // `ret` is undefined in two very different situations: firm-wide scope (no single return in
  // play — expected, not an error) and a return-scoped view whose return didn't resolve (a
  // client with none on file, or a bad :id — a genuine error). Only the second should bail
  // before the search UI renders.
  if (!isFirmWide && !ret) {
    return (
      <main className="p-10">
        <p className="text-sm text-ink/60">{scopeLabel}</p>
      </main>
    )
  }

  return (
    <div className="p-6">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/50">{scopeLabel}</p>
            <h1 className="font-display text-lg font-bold uppercase tracking-wide">Documents</h1>
          </div>
          {!isClient && !isFirmWide && <ScopeToggle search={location.search} />}
        </div>
        <p className="mt-2 font-mono text-sm tabular-nums text-ink/60">
          {filtered.length === records.length
            ? `${records.length} ${records.length === 1 ? "document" : "documents"}`
            : `${filtered.length} of ${records.length} documents`}
        </p>
      </header>

      <div className="mb-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by filename, type, payer, or extracted value…"
          className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ink/40"
        />
        <ChipRow chips={chips} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <FilterPillGroup
              label="Type"
              options={presentTypes}
              optionLabel={(t) => t}
              active={filters.types}
              onToggle={(t) => toggleMulti("type", t)}
            />
            <FilterPillGroup
              label="Status"
              options={presentStatuses}
              optionLabel={(s) => EXTRACTION_STATUS_LABEL[s]}
              active={filters.statuses}
              onToggle={(s) => toggleMulti("status", s)}
            />
            <FilterPillGroup
              label="Confidence"
              options={presentBands}
              optionLabel={(b) => CONFIDENCE_BAND_LABEL[b]}
              active={filters.confidenceBands}
              onToggle={(b) => toggleMulti("confidence", b)}
            />
            {presentUploaders.length > 0 && (
              <FilterPillGroup
                label="Uploaded by"
                options={presentUploaders.map(([id]) => id)}
                optionLabel={(id) => presentUploaders.find(([uid]) => uid === id)?.[1] ?? id}
                active={filters.uploadedBy}
                onToggle={(id) => toggleMulti("uploader", id)}
              />
            )}
            <div>
              <p className="mb-1 font-mono text-[0.625rem] uppercase tracking-wide text-ink/40">Open questions</p>
              <button
                type="button"
                aria-pressed={filters.hasOpenQuestions}
                onClick={toggleOpenQuestions}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.hasOpenQuestions
                    ? "border-state-needs-review-border bg-state-needs-review-fill text-state-needs-review-text"
                    : "border-border text-ink/60 hover:bg-panel"
                )}
              >
                <HelpCircle className="size-3.5" aria-hidden="true" />
                Has open question
              </button>
            </div>
          </div>
          <GroupByToggle value={groupBy} onChange={setGroup} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState query={query} filtersActive={hasActiveFilters(filters)} onClear={clearAll} />
      ) : (
        <DocumentList rows={rows} showReturnLabel={isFirmWide} scrollKey={`${location.pathname}${location.search}`} />
      )}
    </div>
  )
}

export default DocumentExplorer
