import { isClientRole, useRoleStore } from "@/stores/useRoleStore"
import { PlaceholderPage } from "./PlaceholderPage"

/** /home — ClientHome or StaffHome depending on the active role. */
export function Home() {
  const role = useRoleStore((s) => s.role)
  return <PlaceholderPage name={isClientRole(role) ? "ClientHome" : "StaffHome"} />
}

export default Home
