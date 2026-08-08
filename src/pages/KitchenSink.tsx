import { useState } from "react"

import type { FieldState } from "@/types"
import { getDocument, getDocumentsForReturn } from "@/data/fixtures"
import { DEMO_IDS } from "@/data/demoIds"
import { FieldBox } from "@/components/field/FieldBox"
import type { FieldSize } from "@/components/field/fieldVariants"
import { MockFormRenderer } from "@/components/documents/MockFormRenderer"
import { CLIENT_PHASES, STAFF_STATES } from "@/lib/status"
import { cn } from "@/lib/utils"

const SIZES: FieldSize[] = ["sm", "md", "lg"]

const STATE_ROWS: { state: FieldState; label: string }[] = [
  { state: "ai-suggested", label: "AI-suggested" },
  { state: "needs-review", label: "Needs review" },
  { state: "verified", label: "Verified" },
  { state: "editable", label: "Editable" },
  { state: "locked", label: "Locked" },
]

export function KitchenSink() {
  const [lastAction, setLastAction] = useState<string | null>(null)

  function renderStateExample(state: FieldState, size: FieldSize) {
    const label = `Wages, box 1`
    switch (state) {
      case "ai-suggested":
        return (
          <FieldBox
            state={state}
            size={size}
            label={label}
            value={84250}
            confidence={0.82}
            onExplain={() => setLastAction(`Explain requested — ${label} (${size})`)}
            onEdit={(v) => setLastAction(`Edited ${label} (${size}) → ${v}`)}
          />
        )
      case "needs-review":
        return (
          <FieldBox
            state={state}
            size={size}
            label={label}
            value={9312.47}
            onEdit={(v) => setLastAction(`Edited ${label} (${size}) → ${v}`)}
          />
        )
      case "verified":
        return (
          <FieldBox
            state={state}
            size={size}
            label={label}
            value={128.6}
            verifiedBy={{ by: "Priya N.", at: "2026-08-05T14:30:00Z" }}
          />
        )
      case "editable":
        return (
          <FieldBox
            state={state}
            size={size}
            label={label}
            value={1904}
            onEdit={(v) => setLastAction(`Edited ${label} (${size}) → ${v}`)}
          />
        )
      case "locked":
        return (
          <FieldBox
            state={state}
            size={size}
            label={label}
            value={11875.02}
            lockReason="Filed with the IRS on Apr 14 — locked from further edits."
          />
        )
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink p-10">
      <header className="mb-10">
        <p className="font-display text-xs uppercase tracking-widest text-ink/60">Ledgerline</p>
        <h1 className="font-display text-3xl uppercase tracking-wide font-bold mt-1">
          FieldBox kitchen sink
        </h1>
        <p className="font-body text-sm text-ink/70 mt-2 max-w-prose">
          Every field state at every size, plus the edge cases. Tab to a field and press Enter
          to edit it, Escape to cancel. Hover or focus the lock icon on a locked field to see
          why it can't be changed.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          State × size
        </h2>
        <div className="space-y-8">
          {STATE_ROWS.map(({ state, label }) => (
            <div key={state}>
              <p className="font-mono text-xs uppercase tracking-wide text-ink/50 mb-2">{label}</p>
              <div className="flex flex-wrap items-start gap-4">
                {SIZES.map((size) => (
                  <div key={size}>{renderStateExample(state, size)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Edge cases
        </h2>
        <div className="flex flex-wrap items-start gap-4">
          <FieldBox
            state="editable"
            label="Very long value"
            value={123456789012.34}
            onEdit={(v) => setLastAction(`Edited Very long value → ${v}`)}
          />
          <FieldBox
            state="editable"
            label="Zero value"
            value={0}
            onEdit={(v) => setLastAction(`Edited Zero value → ${v}`)}
          />
          <FieldBox
            state="editable"
            label="Negative value"
            value={-450.32}
            onEdit={(v) => setLastAction(`Edited Negative value → ${v}`)}
          />
          <FieldBox
            state="editable"
            label="Missing value"
            value={null}
            onEdit={(v) => setLastAction(`Edited Missing value → ${v}`)}
          />
          <FieldBox
            state="verified"
            label="Total interest income (3 sources)"
            value={1284.91}
            verifiedBy={{ by: "Priya N.", at: "2026-08-02T09:15:00Z" }}
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Staff state → client phase
        </h2>
        <p className="font-body text-sm text-ink/70 mb-4 max-w-prose">
          The 9 internal states firm staff work through, and the 5 plain-language phases a
          client sees instead. Several staff states collapse into a single client phase — that
          collapse is deliberate: it's the complexity clients are never shown.
        </p>
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-panel text-left">
                <th scope="col" className="px-4 py-2 font-display text-xs uppercase tracking-wide">
                  Staff state (internal)
                </th>
                <th scope="col" className="px-4 py-2 font-display text-xs uppercase tracking-wide">
                  Owner
                </th>
                <th scope="col" className="px-4 py-2 font-display text-xs uppercase tracking-wide">
                  Client sees
                </th>
              </tr>
            </thead>
            <tbody>
              {[...STAFF_STATES]
                .sort(
                  (a, b) =>
                    CLIENT_PHASES.findIndex((p) => p.phase === a.clientPhase) -
                    CLIENT_PHASES.findIndex((p) => p.phase === b.clientPhase)
                )
                .map((info) => {
                  const phaseIndex = CLIENT_PHASES.findIndex((p) => p.phase === info.clientPhase)
                  const phase = CLIENT_PHASES[phaseIndex]
                  return (
                    <tr
                      key={info.state}
                      className={cn(
                        "border-b border-border/60 last:border-b-0",
                        phaseIndex % 2 === 1 && "bg-panel/40"
                      )}
                    >
                      <td className="px-4 py-2">{info.label}</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-[0.6875rem] uppercase tracking-wide opacity-60">
                          {info.owner === "client" ? "Client" : "Firm"}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium">{phase.label}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Mock form renderer
        </h2>
        <p className="font-body text-sm text-ink/70 mb-4 max-w-prose">
          Every supported form type, styled to the visual language of the real IRS form it
          represents. The highlighted box on each is a HighlightOverlay positioned by that
          extraction's real bbox — never a second, invented coordinate system. The three W-2s
          below render Ellery's actual seeded box-1 values, pulled through the fixture
          accessors.
        </p>

        <p className="font-mono text-xs uppercase tracking-wide text-ink/50 mb-2">
          W-2 sources — Ellery 2025 (sum into Wages, Form 1040 line 1a)
        </p>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[DEMO_IDS.ELLERY_W2_ACME_DOC, DEMO_IDS.ELLERY_W2_BELMONT_DOC, DEMO_IDS.ELLERY_W2_CORVID_DOC].map(
            (docId) => {
              const doc = getDocument(docId)
              return doc ? <MockFormRenderer key={docId} document={doc} /> : null
            }
          )}
        </div>

        <p className="font-mono text-xs uppercase tracking-wide text-ink/50 mb-2">
          1099-INT, 1099-DIV, and Schedule K-1
        </p>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(() => {
            const interestDoc = getDocument(DEMO_IDS.ELLERY_INTEREST_DOC)
            const divDoc = getDocumentsForReturn(DEMO_IDS.ELLERY_RETURN).find(
              (d) => d.type === "1099-DIV" && d.extractionStatus === "complete"
            )
            const k1Doc = getDocumentsForReturn(DEMO_IDS.VOSS_RETURN).find(
              (d) => d.type === "K-1" && d.extractionStatus === "complete"
            )
            return (
              <>
                {interestDoc && <MockFormRenderer document={interestDoc} />}
                {divDoc && <MockFormRenderer document={divDoc} />}
                {k1Doc && <MockFormRenderer document={k1Doc} />}
              </>
            )
          })()}
        </div>

        <p className="font-mono text-xs uppercase tracking-wide text-ink/50 mb-2">
          Failed extraction — edge case 4
        </p>
        <div className="max-w-xs">
          {(() => {
            const failedDoc = getDocument(DEMO_IDS.ELLERY_FAILED_EXTRACTION_DOC)
            return failedDoc ? <MockFormRenderer document={failedDoc} /> : null
          })()}
        </div>
      </section>

      <section>
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Last interaction
        </h2>
        <p className="font-mono text-sm text-ink/70">
          {lastAction ?? "No interactions yet — tab to a field and press Enter, or click Explain."}
        </p>
      </section>
    </main>
  )
}

export default KitchenSink
