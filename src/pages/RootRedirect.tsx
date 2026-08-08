import { Navigate } from "react-router"

import { getEffectiveRole, isClientRole, useRoleStore } from "@/stores/useRoleStore"

/** / — sends staff to the dashboard and clients toward their return (via /returns). */
export function RootRedirect() {
  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const effectiveRole = getEffectiveRole(role, context)
  return <Navigate to={isClientRole(effectiveRole) ? "/returns" : "/home"} replace />
}

export default RootRedirect
