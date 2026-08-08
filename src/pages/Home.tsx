import { getEffectiveRole, isClientRole, useRoleStore } from "@/stores/useRoleStore"
import { ClientHome } from "./ClientHome"
import { StaffHome } from "./StaffHome"

/** /home — ClientHome or StaffHome depending on the active role (or, for a dual-role user
 * in their personal context, on that context — see useRoleStore.getEffectiveRole). */
export function Home() {
  const role = useRoleStore((s) => s.role)
  const context = useRoleStore((s) => s.context)
  const effectiveRole = getEffectiveRole(role, context)
  return isClientRole(effectiveRole) ? <ClientHome /> : <StaffHome />
}

export default Home
