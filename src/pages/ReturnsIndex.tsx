import { Navigate } from "react-router"

import { DEMO_IDS, getReturnsForUser } from "@/data/fixtures"
import { isClientRole, useRoleStore } from "@/stores/useRoleStore"
import { PlaceholderPage } from "./PlaceholderPage"

// There's no session/auth yet (that's a later phase), so a client role has no real
// identity to resolve "their" return from. Standing in with a fixed demo client until
// the role switcher (2.2) or an auth phase gives us a real signed-in user id.
const DEMO_CLIENT_USER_ID: string = DEMO_IDS.MARCUS_ELLERY_USER

/** /returns — a queue list for staff, or a redirect straight to the client's own return. */
export function ReturnsIndex() {
  const role = useRoleStore((s) => s.role)

  if (isClientRole(role)) {
    const ownReturn = getReturnsForUser(DEMO_CLIENT_USER_ID, role)[0]
    if (ownReturn) {
      return <Navigate to={`/returns/${ownReturn.id}`} replace />
    }
  }

  return <PlaceholderPage name="ReturnsList" />
}

export default ReturnsIndex
