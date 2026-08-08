import { Navigate } from "react-router"

import { isClientRole, useRoleStore } from "@/stores/useRoleStore"

/** / — sends staff to the dashboard and clients toward their return (via /returns). */
export function RootRedirect() {
  const role = useRoleStore((s) => s.role)
  return <Navigate to={isClientRole(role) ? "/returns" : "/home"} replace />
}

export default RootRedirect
