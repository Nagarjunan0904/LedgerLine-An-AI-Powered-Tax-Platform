import { Eye, Lock } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { Thread } from "@/types"
import { cn } from "@/lib/utils"

export type Visibility = Thread["visibility"]

export interface VisibilityToggleProps {
  value: Visibility
  onChange: (value: Visibility) => void
  /** The client's actual name, from fixtures — never a placeholder. The writer sees exactly
   * who is or isn't going to see this before they type a word. */
  clientName: string
  className?: string
}

const OPTIONS: { value: Visibility; label: string; icon: LucideIcon }[] = [
  { value: "internal", label: "Internal", icon: Lock },
  { value: "client-visible", label: "Client-visible", icon: Eye },
]

function descriptionFor(value: Visibility, clientName: string): string {
  return value === "internal"
    ? `Only staff can see this — never shown to ${clientName}`
    : `${clientName} will see this`
}

/**
 * A structural choice, not a checkbox: two full-width options, each carrying its own icon,
 * label, and plain-language description of exactly who sees it. Internal's selected state
 * gets the same tinted surface treatment its messages render with elsewhere — the whole point
 * is that a writer can look at this control, or at what they're about to post, and never have
 * to wonder which mode they're in.
 */
export function VisibilityToggle({ value, onChange, clientName, className }: VisibilityToggleProps) {
  return (
    <div role="radiogroup" aria-label="Who can see this" className={cn("grid grid-cols-2 gap-1.5", className)}>
      {OPTIONS.map((option) => {
        const isSelected = value === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-sm border px-2.5 py-2 text-left outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? option.value === "internal"
                  ? "border-visibility-internal-border bg-visibility-internal-fill text-visibility-internal-text"
                  : "border-ink bg-paper text-ink"
                : "border-border bg-paper text-ink/50 hover:bg-panel"
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {option.label}
            </span>
            <span className="text-[0.6875rem] font-normal normal-case leading-snug opacity-80">
              {descriptionFor(option.value, clientName)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default VisibilityToggle
