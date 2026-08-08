import type { TransformStep } from "@/types"
import type { SourceNode, TransformStepDetail } from "@/lib/provenance"

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function summarizeStep(step: TransformStep, sourceCount: number): string {
  switch (step.op) {
    case "direct":
      return "direct copy from 1 source"
    case "sum":
      return `sum of ${plural(sourceCount, "source")}`
    case "subtract":
      return `difference of ${plural(sourceCount, "source")}`
    case "multiply":
      return `× ${step.factor}`
    case "lookup":
      return `looked up from ${step.table}`
    case "manual-entry":
      return "entered manually"
  }
}

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** A source's value as a plain number, when it has one to add up — null for anything that
 * can't be parsed (an unreadable handwritten OCR value, say), so the equation degrades to
 * "not shown" rather than a wrong or NaN result. */
function sourceNumericValue(source: SourceNode): number | null {
  if (source.kind === "extracted") {
    const match = /^-?\$[\d,]+(\.\d+)?$/.exec(source.extracted.rawValue.trim())
    if (!match) return null
    const negative = source.extracted.rawValue.trim().startsWith("-")
    const n = parseFloat(source.extracted.rawValue.replace(/[^0-9.]/g, ""))
    return negative ? -n : n
  }
  if (source.kind === "field") {
    return typeof source.chain.field.value === "number" ? source.chain.field.value : null
  }
  return null
}

/**
 * The actual arithmetic, not a claim of it: "sum of 3 sources" is the headline, this line is
 * $96,400.00 + $61,300.00 + $26,500.00 = $184,200.00 with every input visible. Renders nothing
 * for ops with no numbers to show (lookup, manual-entry) or when a source can't be parsed as a
 * number at all.
 */
function EquationLine({ step, sources }: { step: TransformStep; sources: SourceNode[] }) {
  if (step.op !== "sum" && step.op !== "subtract" && step.op !== "multiply") return null
  const values = sources.map(sourceNumericValue)
  if (values.some((v) => v === null)) return null
  const nums = values as number[]
  if (nums.length === 0) return null

  let expression: string
  let result: number
  if (step.op === "multiply") {
    result = nums[0] * step.factor
    expression = `${formatMoney(nums[0])} × ${step.factor}`
  } else {
    const operator = step.op === "sum" ? "+" : "−"
    result = step.op === "sum" ? nums.reduce((a, b) => a + b, 0) : nums.reduce((a, b, i) => (i === 0 ? b : a - b))
    expression = nums.map(formatMoney).join(` ${operator} `)
  }

  return (
    <p className="mt-1 pl-5 font-mono text-sm tabular-nums">
      <span className="text-ink/70">{expression}</span>
      <span className="mx-1.5 text-ink/40">=</span>
      <span className="font-semibold">{formatMoney(result)}</span>
    </p>
  )
}

/**
 * Renders one line per transform step: what operation it is, in plain words ("sum of 3
 * sources"), immediately followed by the explicit arithmetic behind that claim when there's
 * arithmetic to show. Accepts any slice of a chain's steps — ProvenanceChain calls this once
 * per step so it can interleave each step's clickable source rows right underneath it.
 */
export function TransformSteps({ steps }: { steps: TransformStepDetail[] }) {
  if (steps.length === 0) return null
  return (
    <div className="space-y-1">
      {steps.map((detail, i) => (
        <div key={i}>
          <p className="flex items-center gap-1.5 text-sm text-ink/70">
            <span aria-hidden="true" className="text-ink/40">
              ▲
            </span>
            {summarizeStep(detail.step, detail.sources.length)}
          </p>
          <EquationLine step={detail.step} sources={detail.sources} />
        </div>
      ))}
    </div>
  )
}

export default TransformSteps
