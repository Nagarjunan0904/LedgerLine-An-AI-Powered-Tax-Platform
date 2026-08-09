import { isRouteErrorResponse, Link, useRouteError } from "react-router"

function describeError(error: unknown): { title: string; detail: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: error.status === 404 ? "Page not found" : `Something went wrong (${error.status})`,
      detail: error.statusText || "The page you were looking for doesn't exist or couldn't be loaded.",
    }
  }
  if (error instanceof Error) {
    return { title: "Something went wrong", detail: error.message }
  }
  return { title: "Something went wrong", detail: "An unexpected error occurred." }
}

/**
 * The router's top-level errorElement — catches anything an unhandled render or route
 * resolution throws, anywhere in the tree. Without this, a crash falls through to React
 * Router's own dev error overlay, which is exactly the outcome to avoid in front of anyone
 * reviewing the app: a real page, with the actual error message and a way back, every time.
 */
export function ErrorPage() {
  const error = useRouteError()
  const { title, detail } = describeError(error)

  if (import.meta.env.DEV) {
    console.error(error)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper p-10 text-center text-ink">
      <p className="font-display text-xs uppercase tracking-widest text-ink/50">Ledgerline</p>
      <h1 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h1>
      <p className="max-w-md text-sm text-ink/60">{detail}</p>
      <div className="mt-2 flex items-center gap-3">
        <Link
          to="/home"
          className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/90"
        >
          Back to home
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium hover:bg-panel"
        >
          Reload
        </button>
      </div>
    </div>
  )
}

export default ErrorPage
