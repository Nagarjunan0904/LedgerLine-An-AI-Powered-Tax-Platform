import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { AlertTriangle } from "lucide-react"

import { chainRowId, traceField, type FieldNode, type SourceNode } from "@/lib/provenance"
import { documentPayerName, parseBoxLabel } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { FieldBox } from "@/components/field/FieldBox"
import { TransformSteps } from "./TransformSteps"

export interface ProvenanceChainProps {
  fieldId: string
}

/** "1040-1a" -> "1040 Line 1a". Distinct from labels.ts's shortFieldLabel (which drops the
 * "1040" entirely for Breadcrumbs) — this header wants the form reference kept. */
function formLineHeading(formLine: string): string {
  const match = /^1040-(.+)$/.exec(formLine)
  return match ? `1040 Line ${match[1]}` : formLine
}

/** "Wages, salaries, tips, etc. (Form 1040, line 1a)" -> "Wages" — strip the trailing form
 * citation, then take the first clause, so the header reads as a name, not a sentence. */
function shortFieldName(label: string): string {
  return label
    .replace(/\s*\([^)]*\)\s*$/, "")
    .split(",")[0]
    .trim()
}

function DisagreementNote({ text }: { text: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-sm border border-state-needs-review-border/60 bg-state-needs-review-fill/40 px-2 py-1.5 text-xs text-state-needs-review-text">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

function ExternalSourceRow({ description }: { description: string }) {
  return (
    <p className="flex items-baseline gap-2 py-1 pl-5 text-sm text-ink/60">
      <span aria-hidden="true" className="shrink-0 text-ink/30">
        ·
      </span>
      {description}
    </p>
  )
}

function ExtractedSourceRow({
  source,
  isLast,
  selected,
  onSelect,
}: {
  source: Extract<SourceNode, { kind: "extracted" }>
  isLast: boolean
  selected: boolean
  onSelect: () => void
}) {
  const { extracted, document, lowConfidence } = source
  const payer = documentPayerName(document) ?? document.fileName
  const box = parseBoxLabel(extracted.label)

  return (
    <button
      id={chainRowId(extracted.id)}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm outline-none",
        "hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-panel ring-1 ring-ink/25"
      )}
    >
      <span aria-hidden="true" className="shrink-0 font-mono text-ink/30">
        {isLast ? "└──" : "├──"}
      </span>
      <span className="min-w-0 flex-1 truncate">{payer}</span>
      <span className="shrink-0 text-xs text-ink/45">Box {box.number}</span>
      <span className="shrink-0 font-mono text-sm tabular-nums">{extracted.rawValue}</span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs tabular-nums",
          lowConfidence ? "font-semibold text-state-needs-review-text" : "text-ink/45"
        )}
      >
        [{extracted.confidence.toFixed(2)}]
      </span>
      {lowConfidence && (
        <AlertTriangle
          className="size-3.5 shrink-0 text-state-needs-review-text"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

function ChainNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FieldNode
  depth: number
  selected: string | null
  onSelect: (extractedId: string) => void
}) {
  return (
    <div className={depth > 0 ? "mt-2 border-l border-ink/15 pl-4" : ""}>
      <FieldBox
        state={node.field.state}
        label={`${formLineHeading(node.field.formLine)} · ${shortFieldName(node.field.label)}`}
        value={node.field.value}
        size="sm"
      />

      {node.sourceDisagreement && <DisagreementNote text={node.sourceDisagreement} />}

      {node.steps.length === 0 ? (
        <p className="mt-2 pl-5 text-sm text-ink/50">No provenance recorded.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {node.steps.map((detail, i) => (
            <div key={i}>
              <TransformSteps steps={[detail]} />
              {detail.sources.length > 0 && (
                <div className="mt-1">
                  {detail.sources.map((source, si) => {
                    if (source.kind === "external") {
                      return <ExternalSourceRow key={si} description={source.description} />
                    }
                    if (source.kind === "field") {
                      return (
                        <ChainNode
                          key={source.chain.field.id}
                          node={source.chain}
                          depth={depth + 1}
                          selected={selected}
                          onSelect={onSelect}
                        />
                      )
                    }
                    return (
                      <ExtractedSourceRow
                        key={source.extracted.id}
                        source={source}
                        isLast={si === detail.sources.length - 1}
                        selected={selected === source.extracted.id}
                        onSelect={() => onSelect(source.extracted.id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The product thesis, rendered: target field, the exact transform that produced it, and every
 * source that fed it — clickable, low-confidence sources flagged before anyone clicks in.
 * Manages its own `?src=` selection in the URL (same pattern as ContextRail/Breadcrumbs) so a
 * page composing this alongside document panels can read the same param independently rather
 * than threading a callback through.
 */
export function ProvenanceChain({ fieldId }: ProvenanceChainProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get("src")
  const node = useMemo(() => traceField(fieldId), [fieldId])

  if (!node) {
    return <p className="text-sm text-ink/50">No field found for {fieldId}.</p>
  }

  function selectSource(extractedId: string) {
    const next = new URLSearchParams(searchParams)
    if (next.get("src") === extractedId) {
      next.delete("src")
    } else {
      next.set("src", extractedId)
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="font-body">
      <ChainNode node={node} depth={0} selected={selected} onSelect={selectSource} />
    </div>
  )
}

export default ProvenanceChain
