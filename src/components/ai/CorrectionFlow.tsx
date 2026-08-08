import { useEffect, useRef, useState } from "react"
import { UserCheck, X } from "lucide-react"

import type { ReturnField } from "@/types"
import { getProvenance, getUser } from "@/data/fixtures"
import { cn } from "@/lib/utils"
import { useRoleStore } from "@/stores/useRoleStore"
import { useCorrectionsStore } from "@/stores/useCorrectionsStore"
import { FieldBox } from "@/components/field/FieldBox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffectiveField } from "./useCorrectionFlow"

const REASON_OPTIONS = ["Misread a digit", "Wrong box on the form", "Outdated document", "Other"]

/** Quiet and dismissible: preset one-click reasons (a real product's training signal is more
 * useful structured than free-typed anyway), or an explicit dismiss — either way it stops
 * asking. */
function ReasonPrompt({ fieldId }: { fieldId: string }) {
  const setReason = useCorrectionsStore((s) => s.setReason)
  const dismiss = useCorrectionsStore((s) => s.dismissReasonPrompt)

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-sm border border-border bg-panel/60 px-2 py-1.5 text-xs">
      <span className="text-ink/50">Why was this wrong?</span>
      {REASON_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setReason(fieldId, option)}
          className="rounded-full border border-border px-2 py-0.5 hover:bg-panel"
        >
          {option}
        </button>
      ))}
      <button
        type="button"
        onClick={() => dismiss(fieldId)}
        aria-label="Dismiss"
        className="ml-auto text-ink/40 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

/** The subtle marker: a human overrode the AI here. Original value on hover — never
 * destroyed, always one hover away. */
function CorrectedMarker({ originalValue }: { originalValue: number | string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-state-verified-border bg-paper text-state-verified-text"
          aria-label={`Corrected by a preparer. Original value: ${originalValue}`}
        >
          <UserCheck className="size-2.5" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>Corrected by a preparer · original: {originalValue}</TooltipContent>
    </Tooltip>
  )
}

export interface CorrectionFlowProps {
  field: ReturnField
  /** True while this specific field should be in FieldBox's own edit mode. */
  isEditing: boolean
  onExplain?: () => void
  /** Called once an edit is committed — lets the caller clear its own "which field is
   * editing" state. */
  onCommitted?: () => void
}

/**
 * Wraps one ReturnField's FieldBox with the full correction flow: inline edit, audit trail,
 * a brief flash when a source correction ripples into this field's recomputed value, the
 * quiet "why was this wrong" prompt, and the corrected marker. FieldBox has no external
 * "start editing" API, so isEditing turning on dispatches a real click at FieldBox's own
 * root — the same click a pointer would send — rather than reimplementing its edit UI.
 */
export function CorrectionFlow({ field, isEditing, onExplain, onCommitted }: CorrectionFlowProps) {
  const userId = useRoleStore((s) => s.userId)
  const correctField = useCorrectionsStore((s) => s.correctField)
  const effective = useEffectiveField(field)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [flash, setFlash] = useState(false)
  const lastRecalculatedValue = useRef<number | string | null>(null)

  useEffect(() => {
    if (!isEditing) return
    const trigger = wrapperRef.current?.querySelector<HTMLElement>('[data-slot="field-box"]')
    trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  }, [isEditing])

  // Flashes once whenever a ripple actually changes this field's displayed value — not on
  // every render, and not for a direct correction of this field itself (that already has its
  // own edit-committed feedback via FieldBox settling into its new value).
  useEffect(() => {
    if (!effective.isRecalculated) {
      lastRecalculatedValue.current = null
      return
    }
    if (lastRecalculatedValue.current === effective.value) return
    lastRecalculatedValue.current = effective.value
    setFlash(true)
    const timeout = setTimeout(() => setFlash(false), 1000)
    return () => clearTimeout(timeout)
  }, [effective.isRecalculated, effective.value])

  function handleEdit(raw: string) {
    const parsed = Number(raw)
    const newValue = raw.trim() !== "" && !Number.isNaN(parsed) && typeof field.value === "number" ? parsed : raw
    correctField(field.id, {
      by: userId,
      previousValue: field.value,
      newValue,
      previousState: field.state,
      newState: "verified",
    })
    onCommitted?.()
  }

  const prov = getProvenance(field.id)
  const confidence = field.state === "ai-suggested" ? prov?.confidence : undefined
  const verifiedBy = effective.correction
    ? { by: getUser(effective.correction.by)?.name ?? effective.correction.by, at: effective.correction.at }
    : field.state === "verified" && prov?.verification
      ? { by: getUser(prov.verification.by)?.name ?? prov.verification.by, at: prov.verification.at }
      : undefined

  const showReasonPrompt = Boolean(effective.correction && !effective.correction.reasonPromptDismissed)

  return (
    <div>
      <div
        ref={wrapperRef}
        className={cn(
          "relative rounded-sm outline-none ring-state-verified-border transition-shadow duration-700",
          flash && "ring-2"
        )}
      >
        <FieldBox
          state={effective.state}
          label={field.label}
          value={effective.value}
          confidence={confidence}
          lockReason={field.lockReason}
          verifiedBy={verifiedBy}
          onEdit={isEditing ? handleEdit : undefined}
          onExplain={onExplain}
        />
        {effective.isCorrected && effective.originalValue !== null && (
          <CorrectedMarker originalValue={effective.originalValue} />
        )}
      </div>
      {showReasonPrompt && <ReasonPrompt fieldId={field.id} />}
    </div>
  )
}

export default CorrectionFlow
