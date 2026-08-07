import { useEffect, useId, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { CheckCircle2, Flag, HelpCircle, Lock, Pencil, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import type { FieldState } from "@/types"
import {
  fieldLabelTextClass,
  fieldMarkerSizeClass,
  fieldValueTextClass,
  fieldVariants,
  type FieldSize,
} from "./fieldVariants"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export interface FieldBoxVerifiedBy {
  /** Display name — user-resolution from a UserRef isn't wired up yet. */
  by: string
  /** ISO 8601 timestamp */
  at: string
}

export interface FieldBoxProps {
  state: FieldState
  label: string
  value: number | string | null
  size?: FieldSize
  /** 0–1, shown on ai-suggested fields */
  confidence?: number
  /** Called with the new raw value when the user commits an edit (Enter). Ignored when state is 'locked'. */
  onEdit?: (value: string) => void
  onExplain?: () => void
  lockReason?: string
  verifiedBy?: FieldBoxVerifiedBy
  className?: string
}

const STATE_ICON: Record<FieldState, LucideIcon> = {
  "ai-suggested": Sparkles,
  "needs-review": Flag,
  verified: CheckCircle2,
  editable: Pencil,
  locked: Lock,
}

function formatDisplayValue(value: number | string | null) {
  if (value === null) {
    return { text: "—", isNumeric: false }
  }
  if (typeof value === "number") {
    return {
      text: value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      isNumeric: true,
    }
  }
  return { text: value, isNumeric: false }
}

function describeState(
  state: FieldState,
  opts: { confidence?: number; verifiedBy?: FieldBoxVerifiedBy; lockReason?: string }
) {
  switch (state) {
    case "ai-suggested":
      return opts.confidence != null
        ? `AI-suggested value, ${Math.round(opts.confidence * 100)}% confidence, not yet reviewed`
        : "AI-suggested value, not yet reviewed"
    case "needs-review":
      return "Flagged for a preparer to review"
    case "verified":
      return opts.verifiedBy
        ? `Verified by ${opts.verifiedBy.by} on ${format(new Date(opts.verifiedBy.at), "MMM d, yyyy")}`
        : "Verified"
    case "editable":
      return "Editable"
    case "locked":
      return opts.lockReason ? `Locked: ${opts.lockReason}` : "Locked"
  }
}

export function FieldBox({
  state,
  label,
  value,
  size = "md",
  confidence,
  onEdit,
  onExplain,
  lockReason,
  verifiedBy,
  className,
}: FieldBoxProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const descriptionId = useId()

  const canEdit = state !== "locked" && Boolean(onEdit)
  const isTrigger = canEdit && !isEditing
  const Marker = STATE_ICON[state]
  const { text: displayText, isNumeric } = formatDisplayValue(value)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  function beginEdit() {
    if (!canEdit) return
    setDraft(value === null ? "" : String(value))
    setIsEditing(true)
  }

  function commitEdit() {
    onEdit?.(draft)
    setIsEditing(false)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      beginEdit()
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      commitEdit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div
      data-slot="field-box"
      data-state={state}
      className={cn(fieldVariants({ state, size, interactive: isTrigger }), className)}
      tabIndex={isTrigger ? 0 : undefined}
      role={isTrigger ? "button" : undefined}
      aria-label={isTrigger ? `${label}, ${displayText}. Press Enter to edit.` : undefined}
      aria-describedby={descriptionId}
      onClick={isTrigger ? beginEdit : undefined}
      onKeyDown={isTrigger ? handleTriggerKeyDown : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "font-body font-medium uppercase tracking-wide opacity-70",
            fieldLabelTextClass[size]
          )}
        >
          {label}
        </span>
        {state === "locked" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-[2px] opacity-70 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => event.stopPropagation()}
                aria-label={lockReason ? `Locked: ${lockReason}` : "Locked"}
              >
                <Marker className={fieldMarkerSizeClass[size]} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{lockReason ?? "This field is locked."}</TooltipContent>
          </Tooltip>
        ) : (
          <Marker
            className={cn("shrink-0 opacity-70", fieldMarkerSizeClass[size])}
            aria-hidden="true"
          />
        )}
      </div>

      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={cancelEdit}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "border-b border-current bg-transparent font-mono tabular-nums outline-none",
            fieldValueTextClass[size]
          )}
        />
      ) : (
        <div className="overflow-x-auto">
          <span
            className={cn(
              "whitespace-nowrap",
              isNumeric ? "font-mono tabular-nums" : "font-body",
              fieldValueTextClass[size]
            )}
          >
            {displayText}
          </span>
        </div>
      )}

      <span id={descriptionId} className="sr-only">
        {describeState(state, { confidence, verifiedBy, lockReason })}
      </span>

      {state === "ai-suggested" && (confidence != null || onExplain) && (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {confidence != null && (
            <span className="font-mono text-[0.6875rem] tabular-nums opacity-80">
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
          {onExplain && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onExplain()
              }}
              className="inline-flex items-center gap-1 text-[0.6875rem] font-medium underline decoration-current/40 underline-offset-2 hover:decoration-current"
            >
              <HelpCircle className="size-3" aria-hidden="true" />
              Explain
            </button>
          )}
        </div>
      )}

      {state === "verified" && verifiedBy && (
        <p className="mt-0.5 text-[0.6875rem] opacity-80">
          Verified by {verifiedBy.by} · {format(new Date(verifiedBy.at), "MMM d, yyyy")}
        </p>
      )}
    </div>
  )
}
