import { Navigate } from "react-router"

import { getReturnsForUser } from "@/data/fixtures"
import { getEffectiveRole, isClientRole, useRoleStore } from "@/stores/useRoleStore"
import { PlaceholderPage } from "./PlaceholderPage"

/** /returns — a queue list for staff, or a redirect straight to the client's own return. */
export function ReturnsIndex() {
  const role = useRoleStore((s) => s.role)
  const userId = useRoleStore((s) => s.userId)
  const context = useRoleStore((s) => s.context)
  const effectiveRole = getEffectiveRole(role, context)

  if (isClientRole(effectiveRole)) {
    const ownReturn = getReturnsForUser(userId, effectiveRole)[0]
    if (ownReturn) {
      return <Navigate to={`/returns/${ownReturn.id}`} replace />
    }
  }

  return <PlaceholderPage name="ReturnsList" />
}

export default ReturnsIndex
