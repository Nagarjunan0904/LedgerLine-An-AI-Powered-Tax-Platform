import { useParams, useSearchParams } from "react-router"

interface PlaceholderPageProps {
  name: string
}

function ParamList({ entries }: { entries: [string, string][] }) {
  if (entries.length === 0) {
    return <p className="font-mono text-sm opacity-50">(none)</p>
  }
  return (
    <dl className="space-y-1 font-mono text-sm">
      {entries.map(([key, value], i) => (
        <div key={`${key}-${i}`} className="flex gap-2">
          <dt className="opacity-60">{key}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Stands in for every route that doesn't have a real screen yet. Renders the page name plus
 * whatever the router resolved, so routing can be verified end to end before any real UI
 * exists.
 */
export function PlaceholderPage({ name }: PlaceholderPageProps) {
  const params = useParams()
  const [searchParams] = useSearchParams()

  return (
    <div className="p-10">
      <p className="font-display text-xs uppercase tracking-widest opacity-60">Placeholder</p>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide mt-1">{name}</h1>

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-50 mb-2">Route params</h2>
        <ParamList entries={Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)} />
      </section>

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-50 mb-2">Search params</h2>
        <ParamList entries={[...searchParams.entries()]} />
      </section>
    </div>
  )
}

export default PlaceholderPage
