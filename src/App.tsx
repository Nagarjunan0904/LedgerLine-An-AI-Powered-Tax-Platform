import type { FieldState } from '@/types'

const STATES: { state: FieldState; description: string }[] = [
  { state: 'ai-suggested', description: 'AI proposed this value; no one has looked at it yet' },
  { state: 'needs-review', description: 'Flagged for a preparer to confirm' },
  { state: 'verified', description: 'A person checked this and signed off' },
  { state: 'editable', description: 'Open for direct entry' },
  { state: 'locked', description: 'Filed, or otherwise closed to edits' },
]

const FIGURES = [
  { label: 'Wages, tips, other comp.', value: 84250.0 },
  { label: 'Federal income tax withheld', value: 9312.47 },
  { label: 'Interest income', value: 128.6 },
  { label: 'Qualified dividends', value: 1904.0 },
  { label: 'Total tax', value: 11875.02 },
]

function StateSwatch({ state, description }: { state: FieldState; description: string }) {
  return (
    <div
      className="rounded-sm border p-4"
      style={{
        borderColor: `var(--state-${state}-border)`,
        backgroundColor: `var(--state-${state}-fill)`,
        color: `var(--state-${state}-text)`,
      }}
    >
      <p className="font-display text-xs uppercase tracking-wider font-semibold">{state}</p>
      <p className="mt-1 text-sm">{description}</p>
      <dl className="mt-3 space-y-1 text-xs font-mono">
        <div className="flex justify-between gap-4">
          <dt className="opacity-70">border</dt>
          <dd>--color-state-{state}-border</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="opacity-70">fill</dt>
          <dd>--color-state-{state}-fill</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="opacity-70">text</dt>
          <dd>--color-state-{state}-text</dd>
        </div>
      </dl>
    </div>
  )
}

function App() {
  return (
    <main className="min-h-screen bg-paper text-ink p-10">
      <header className="mb-12">
        <p className="font-display text-xs uppercase tracking-widest text-ink/60">Ledgerline</p>
        <h1 className="font-display text-3xl uppercase tracking-wide font-bold mt-1">
          Design token proof sheet
        </h1>
        <p className="font-body text-sm text-ink/70 mt-2 max-w-prose">
          Every color, font, and figure style the product uses, rendered directly from the
          tokens in <code className="font-mono text-xs bg-panel px-1 py-0.5 rounded-sm">src/index.css</code>.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Field state
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STATES.map(({ state, description }) => (
            <StateSwatch key={state} state={state} description={description} />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Type
        </h2>
        <div className="space-y-6">
          <div className="rounded-sm border bg-panel/50 p-4">
            <p className="font-mono text-xs text-ink/60 mb-2">--font-display · Archivo</p>
            <p className="font-display text-2xl uppercase tracking-wide font-bold">
              Schedule C — Profit or Loss
            </p>
          </div>
          <div className="rounded-sm border bg-panel/50 p-4">
            <p className="font-mono text-xs text-ink/60 mb-2">--font-body · Inter Variable</p>
            <p className="font-body text-base">
              This return has three open items before it can move to review. The client was
              notified on August 4th.
            </p>
          </div>
          <div className="rounded-sm border bg-panel/50 p-4">
            <p className="font-mono text-xs text-ink/60 mb-2">
              --font-mono · JetBrains Mono Variable · tabular-nums
            </p>
            <p className="font-mono text-2xl">1,204,309.48</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-sm uppercase tracking-widest font-semibold border-b pb-2 mb-4">
          Tabular alignment
        </h2>
        <div className="rounded-sm border max-w-sm">
          {FIGURES.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between items-baseline gap-6 px-4 py-2 ${
                i !== FIGURES.length - 1 ? 'border-b' : ''
              }`}
            >
              <span className="font-body text-sm text-ink/70">{row.label}</span>
              <span className="font-mono text-sm tabular-nums text-right">
                {row.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
