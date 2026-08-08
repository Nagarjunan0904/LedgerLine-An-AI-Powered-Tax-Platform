import type { ReactNode } from "react"
import { Link } from "react-router"
import { ArrowRight, ImageOff } from "lucide-react"

import type { Document, FieldState } from "@/types"
import { getExtractedFieldsForDocument, getFieldsForReturn, getOpenItemsForReturn, getProvenance, getReturn } from "@/data/fixtures"
import { documentPayerName } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { HighlightOverlay } from "./HighlightOverlay"

export interface MockFormRendererProps {
  document: Document
  /** When this matches one of the document's ExtractedField ids, that region pulses and
   * scrolls into view — the landing spot for provenance navigation (4.2). */
  highlightId?: string
}

// ---------------------------------------------------------------------------
// Shared form chrome — every template is built from the same handful of pieces so a CPA
// sees one consistent visual language across form types, not four different experiments.
// ---------------------------------------------------------------------------

function FormPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[850/1100] w-full overflow-hidden rounded-sm border border-ink/25 bg-paper shadow-sm",
        className
      )}
    >
      {children}
    </div>
  )
}

/** The page's normal-flow content, including the money-box grid — the live-data highlight is
 * a real grid cell inside it now, not a floating sibling (see MoneyBoxGrid). */
function FormStaticLayer({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex flex-col gap-1.5 p-2.5">{children}</div>
}

function FormHeader({
  title,
  formNumber,
  taxYear,
}: {
  title: string
  formNumber: string
  taxYear: number
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-ink/15 pb-1.5">
      <p className="font-display text-[0.625rem] font-bold uppercase tracking-wide">{title}</p>
      <div className="shrink-0 text-right leading-tight">
        <p className="font-mono text-[0.5625rem] tabular-nums text-ink/50">Form {formNumber}</p>
        <p className="font-mono text-[0.5625rem] tabular-nums text-ink/50">{taxYear}</p>
      </div>
    </div>
  )
}

function InfoBox({ caption, lines }: { caption: string; lines: string[] }) {
  return (
    <div className="rounded-[2px] border border-ink/25 p-1.5">
      <p className="text-[0.5rem] uppercase tracking-wide text-ink/45">{caption}</p>
      {lines.map((line, i) => (
        <p key={i} className="truncate text-[0.6875rem] leading-tight">
          {line}
        </p>
      ))}
    </div>
  )
}

/** A numbered box with no extracted data behind it. "—" matches FieldBox's own convention
 * for a missing value — never a fabricated figure. */
function PlaceholderBox({ number, caption }: { number: string; caption: string }) {
  return (
    <div className="rounded-[2px] border border-ink/20 p-1.5">
      <p className="flex items-baseline gap-1">
        <span className="font-mono text-[0.625rem] font-bold text-ink/70">{number}</span>
        <span className="truncate text-[0.5rem] uppercase leading-tight tracking-wide text-ink/40">{caption}</span>
      </p>
      <p className="mt-0.5 font-mono text-xs tabular-nums text-ink/30">—</p>
    </div>
  )
}

/** The content of the one box per form that has a real ExtractedField behind it — rendered
 * inside HighlightOverlay, never as a PlaceholderBox. Full caption, no truncation: this is
 * the box the whole demo is about. */
function DataBoxContent({ number, caption, value }: { number: string; caption: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-baseline gap-1">
        <span className="font-mono text-[0.625rem] font-bold">{number}</span>
        <span className="text-[0.5rem] uppercase leading-tight tracking-wide opacity-75">{caption}</span>
      </p>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** "Box 1 — Wages, tips, other compensation" -> { number: "1", description: "Wages, tips,
 * other compensation" }. Reads the box number and full caption straight off the fixture's own
 * ExtractedField.label instead of a second, hand-typed copy that could drift from it. */
function parseBoxLabel(label: string): { number: string; description: string } {
  const match = /^Box\s+(\S+)\s+—\s+(.+)$/.exec(label)
  return match ? { number: match[1], description: match[2] } : { number: "", description: label }
}

/**
 * The form's numbered money-box grid. Box 1 (the one with real data, if any) sits top-right —
 * row one, right column, with row one's left column left blank — so it reads directly above
 * the next row's boxes 2 and 3, the way it does on the real form. Everything else auto-flows
 * beneath it as plain PlaceholderBoxes.
 */
function MoneyBoxGrid({
  highlight,
  placeholders,
}: {
  highlight: ReactNode
  placeholders: { number: string; caption: string }[]
}) {
  return (
    <div className="mt-auto grid grid-cols-2 gap-1.5">
      <div aria-hidden="true" />
      {highlight}
      {placeholders.map((box) => (
        <PlaceholderBox key={box.number} number={box.number} caption={box.caption} />
      ))}
    </div>
  )
}

function DocumentCaption({ document: doc }: { document: Document }) {
  const extracted = getExtractedFieldsForDocument(doc.id)[0]
  return (
    <p className="text-center text-xs text-ink/50">
      {doc.fileName}
      {extracted && (
        <>
          {" "}
          <span className="font-mono tabular-nums">
            · page {extracted.page} of {doc.pageCount} · {Math.round(extracted.confidence * 100)}% confidence
          </span>
        </>
      )}
    </p>
  )
}

/** Which ReturnField.state (if any) this extraction feeds, via Provenance.sourceFieldIds.
 * A raw extraction nothing downstream has touched yet is honestly "ai-suggested" — not yet
 * reviewed by anyone, which is simply true of it. */
function resolveFieldState(returnId: string, extractedId: string): FieldState {
  for (const field of getFieldsForReturn(returnId)) {
    if (getProvenance(field.id)?.sourceFieldIds.includes(extractedId)) return field.state
  }
  return "ai-suggested"
}

// ---------------------------------------------------------------------------
// Form templates
// ---------------------------------------------------------------------------

function W2Form({ document: doc, highlightId }: { document: Document; highlightId?: string }) {
  const ret = getReturn(doc.returnId)!
  const extracted = getExtractedFieldsForDocument(doc.id)[0]
  const employer = documentPayerName(doc) ?? "Employer"
  const box1 = extracted ? parseBoxLabel(extracted.label) : null

  return (
    <div className="w-full space-y-2">
      <FormPage>
        <FormStaticLayer>
          <FormHeader title="Wage and Tax Statement" formNumber="W-2" taxYear={ret.taxYear} />
          <InfoBox caption="Employer's name, address, and ZIP code" lines={[employer, "—"]} />
          <InfoBox caption="Employee's name, address, and ZIP code" lines={[ret.clientName, "—"]} />
          <MoneyBoxGrid
            highlight={
              extracted && box1 ? (
                <HighlightOverlay
                  id={extracted.id}
                  bbox={extracted.bbox}
                  state={resolveFieldState(doc.returnId, extracted.id)}
                  label={extracted.label}
                  pulse={extracted.id === highlightId}
                >
                  <DataBoxContent number={box1.number} caption={box1.description} value={extracted.rawValue} />
                </HighlightOverlay>
              ) : (
                <PlaceholderBox number="1" caption="Wages, tips, other compensation" />
              )
            }
            placeholders={[
              { number: "2", caption: "Federal income tax withheld" },
              { number: "3", caption: "Social security wages" },
              { number: "4", caption: "Social security tax withheld" },
              { number: "5", caption: "Medicare wages and tips" },
            ]}
          />
        </FormStaticLayer>
      </FormPage>
      <DocumentCaption document={doc} />
    </div>
  )
}

function Form1099Int({ document: doc, highlightId }: { document: Document; highlightId?: string }) {
  const ret = getReturn(doc.returnId)!
  const extracted = getExtractedFieldsForDocument(doc.id)[0]
  const payer = documentPayerName(doc) ?? "Payer"
  const box1 = extracted ? parseBoxLabel(extracted.label) : null

  return (
    <div className="w-full space-y-2">
      <FormPage>
        <FormStaticLayer>
          <FormHeader title="Interest Income" formNumber="1099-INT" taxYear={ret.taxYear} />
          <InfoBox caption="Payer's name, street address, and ZIP code" lines={[payer, "—"]} />
          <InfoBox caption="Recipient's name" lines={[ret.clientName]} />
          <MoneyBoxGrid
            highlight={
              extracted && box1 ? (
                <HighlightOverlay
                  id={extracted.id}
                  bbox={extracted.bbox}
                  state={resolveFieldState(doc.returnId, extracted.id)}
                  label={extracted.label}
                  pulse={extracted.id === highlightId}
                >
                  <DataBoxContent number={box1.number} caption={box1.description} value={extracted.rawValue} />
                </HighlightOverlay>
              ) : (
                <PlaceholderBox number="1" caption="Interest income" />
              )
            }
            placeholders={[
              { number: "2", caption: "Early withdrawal penalty" },
              { number: "3", caption: "Interest on U.S. savings bonds" },
              { number: "4", caption: "Federal income tax withheld" },
              { number: "8", caption: "Tax-exempt interest" },
            ]}
          />
        </FormStaticLayer>
      </FormPage>
      <DocumentCaption document={doc} />
    </div>
  )
}

function Form1099Div({ document: doc, highlightId }: { document: Document; highlightId?: string }) {
  const ret = getReturn(doc.returnId)!
  const extracted = getExtractedFieldsForDocument(doc.id)[0]
  const payer = documentPayerName(doc) ?? "Payer"
  const box1 = extracted ? parseBoxLabel(extracted.label) : null

  return (
    <div className="w-full space-y-2">
      <FormPage>
        <FormStaticLayer>
          <FormHeader title="Dividends and Distributions" formNumber="1099-DIV" taxYear={ret.taxYear} />
          <InfoBox caption="Payer's name, street address, and ZIP code" lines={[payer, "—"]} />
          <InfoBox caption="Recipient's name" lines={[ret.clientName]} />
          <MoneyBoxGrid
            highlight={
              extracted && box1 ? (
                <HighlightOverlay
                  id={extracted.id}
                  bbox={extracted.bbox}
                  state={resolveFieldState(doc.returnId, extracted.id)}
                  label={extracted.label}
                  pulse={extracted.id === highlightId}
                >
                  <DataBoxContent number={box1.number} caption={box1.description} value={extracted.rawValue} />
                </HighlightOverlay>
              ) : (
                <PlaceholderBox number="1a" caption="Total ordinary dividends" />
              )
            }
            placeholders={[
              { number: "1b", caption: "Qualified dividends" },
              { number: "2a", caption: "Total capital gain distr." },
              { number: "2b", caption: "Unrecap. section 1250 gain" },
              { number: "4", caption: "Federal income tax withheld" },
            ]}
          />
        </FormStaticLayer>
      </FormPage>
      <DocumentCaption document={doc} />
    </div>
  )
}

function FormK1({ document: doc, highlightId }: { document: Document; highlightId?: string }) {
  const ret = getReturn(doc.returnId)!
  const extracted = getExtractedFieldsForDocument(doc.id)[0]
  // documentPayerName strips "K-1 <year>" but the generator's K-1 filenames read
  // "<payer> Schedule K-1 <year>" — "Schedule" is left dangling and needs its own trim.
  const partnership = documentPayerName(doc)?.replace(/\s+Schedule$/i, "") ?? "Partnership"
  const box1 = extracted ? parseBoxLabel(extracted.label) : null

  return (
    <div className="w-full space-y-2">
      <FormPage>
        <FormStaticLayer>
          <FormHeader title="Partner's Share of Income" formNumber="Schedule K-1" taxYear={ret.taxYear} />
          <InfoBox caption="Partnership's name, address, and ZIP code" lines={[partnership, "—"]} />
          <InfoBox caption="Partner's name, address, and ZIP code" lines={[ret.clientName, "—"]} />
          <MoneyBoxGrid
            highlight={
              extracted && box1 ? (
                <HighlightOverlay
                  id={extracted.id}
                  bbox={extracted.bbox}
                  state={resolveFieldState(doc.returnId, extracted.id)}
                  label={extracted.label}
                  pulse={extracted.id === highlightId}
                >
                  <DataBoxContent number={box1.number} caption={box1.description} value={extracted.rawValue} />
                </HighlightOverlay>
              ) : (
                <PlaceholderBox number="1" caption="Ordinary business income" />
              )
            }
            placeholders={[
              { number: "2", caption: "Net rental real estate income" },
              { number: "3", caption: "Other net rental income" },
              { number: "4a", caption: "Guaranteed payments" },
              { number: "13", caption: "Other deductions" },
            ]}
          />
        </FormStaticLayer>
      </FormPage>
      <DocumentCaption document={doc} />
    </div>
  )
}

/**
 * Edge case 4: extraction that never completed. No boxes, no fabricated figures — a plain
 * statement of what happened and what a person needs to do about it, reusing the real open
 * item's own words rather than inventing new copy for the same fact.
 */
function FailedExtractionForm({ document: doc }: { document: Document }) {
  const ret = getReturn(doc.returnId)!
  const relatedItem = getOpenItemsForReturn(doc.returnId).find((item) =>
    item.linkedObjects.some((ref) => ref.type === "document" && ref.id === doc.id)
  )

  return (
    <div className="w-full space-y-2">
      <FormPage className="border-state-needs-review-border/50">
        <FormStaticLayer>
          <FormHeader title="Extraction failed" formNumber={doc.type} taxYear={ret.taxYear} />
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <div className="relative flex aspect-[3/4] w-1/2 -rotate-2 items-center justify-center overflow-hidden rounded-sm border border-ink/15 bg-gradient-to-br from-ink/15 via-ink/5 to-ink/20">
              <ImageOff className="size-7 text-ink/30" aria-hidden="true" />
            </div>
          </div>
        </FormStaticLayer>
      </FormPage>
      <DocumentCaption document={doc} />

      <div className="space-y-2 rounded-sm border border-state-needs-review-border/60 bg-state-needs-review-fill/40 p-3">
        <div>
          <p className="font-mono text-[0.625rem] uppercase tracking-wide text-ink/50">What we read</p>
          <p className="text-sm">Nothing — the image was too degraded for extraction to complete.</p>
        </div>
        <div>
          <p className="font-mono text-[0.625rem] uppercase tracking-wide text-ink/50">What we need from you</p>
          <p className="text-sm">
            {relatedItem?.description ?? "Re-upload a clearer copy, or enter the amount manually."}
          </p>
        </div>
        {relatedItem && (
          <Link
            to={`/returns/${ret.id}/items?item=${relatedItem.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
          >
            Open this item
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}

function UnsupportedForm({ document: doc }: { document: Document }) {
  return (
    <div className="w-full rounded-sm border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
      No mock form template for {doc.type} documents yet.
    </div>
  )
}

/**
 * Renders a document as an on-screen form styled to the visual language of the real IRS form
 * it represents — boxed grid, numbered box captions, mono figures — never a styled card. The
 * one box per template that carries real extracted data is a HighlightOverlay positioned by
 * that ExtractedField's own bbox; everything else is static structure with no fabricated
 * values. A document whose extraction failed entirely gets its own honest treatment instead
 * of a form full of dashes.
 */
export function MockFormRenderer({ document: doc, highlightId }: MockFormRendererProps) {
  if (doc.extractionStatus === "failed") {
    return <FailedExtractionForm document={doc} />
  }
  switch (doc.type) {
    case "W-2":
      return <W2Form document={doc} highlightId={highlightId} />
    case "1099-INT":
      return <Form1099Int document={doc} highlightId={highlightId} />
    case "1099-DIV":
      return <Form1099Div document={doc} highlightId={highlightId} />
    case "K-1":
      return <FormK1 document={doc} highlightId={highlightId} />
    default:
      return <UnsupportedForm document={doc} />
  }
}

export default MockFormRenderer
