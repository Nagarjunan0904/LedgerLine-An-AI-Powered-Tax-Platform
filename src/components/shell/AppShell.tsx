import { Outlet } from "react-router"

/**
 * Persists across navigation (it's the layout route's element, not remounted per-page) so
 * scroll position and any shell-level state survive route changes. Placeholder — 2.2 fills
 * this in with the real nav/role switcher.
 */
export function AppShell() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Outlet />
    </div>
  )
}

export default AppShell
