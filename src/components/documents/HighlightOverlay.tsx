import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import type { BBox, FieldState } from "@/types"
import { cn } from "@/lib/utils"

/**
 * Border treatment mirrors fieldVariants.ts exactly (dashed/double/solid-2/solid/borderless)
 * so state reads the same whether it's a FieldBox in a panel or a region on the document
 * itself — the whole point of carrying state through more than color.
 */
const STATE_HIGHLIGHT_CLASS: Record<FieldState, string> = {
  "ai-suggested": "border border-dashed border-state-ai-suggested-border bg-state-ai-suggested-fill/70",
  "needs-review": "border-4 border-double border-state-needs-review-border bg-state-needs-review-fill/70",
  verified: "border-2 border-solid border-state-verified-border bg-state-verified-fill/70",
  editable: "border border-solid border-state-editable-border bg-state-editable-fill/70",
  locked: "border border-solid border-state-locked-border bg-state-locked-fill/70",
}

const STATE_TEXT_CLASS: Record<FieldState, string> = {
  "ai-suggested": "text-state-ai-suggested-text",
  "needs-review": "text-state-needs-review-text",
  verified: "text-state-verified-text",
  editable: "text-state-editable-text",
  locked: "text-state-locked-text",
}

export interface HighlightOverlayProps {
  /** Stable and unique — this is the DOM id the provenance connector (4.2) measures via
   * getBoundingClientRect to anchor a line onto. Callers should pass the ExtractedField's own
   * id: it's already the stable, globally-unique handle for "this region of this document." */
  id: string
  /** Normalized 0–1, read directly from ExtractedField.bbox, never invented. Not used to
   * position this element — see the component doc comment — but carried through as a data
   * attribute so the source coordinates stay attached to the DOM node for anything that
   * wants them later. */
  bbox: BBox
  state: FieldState
  /** Accessible name and title — what a screen reader or a hover tooltip says this region is. */
  label: string
  /** True for the moment of navigation: scrolls itself into view, focuses itself, and plays a
   * brief one-shot flash. False the rest of the time — this isn't a standing decoration. */
  pulse?: boolean
  children?: ReactNode
  className?: string
}

/**
 * Wraps a region IN PLACE — the cell keeps whatever position its own layout (grid, flex,
 * normal flow) already gives it. This deliberately does not position via bbox: a mock form
 * rebuilt from scratch in CSS doesn't share a coordinate space with the bbox captured off the
 * original scanned page, so pinning to it just floats the highlight over the wrong spot. What
 * bbox-based positioning would have bought us — the provenance connector finding this region
 * on screen — getBoundingClientRect() gets for free from a real, uniquely-id'd DOM node
 * regardless of how it's laid out, which is all 4.2 actually needs.
 */
export function HighlightOverlay({
  id,
  bbox,
  state,
  label,
  pulse = false,
  children,
  className,
}: HighlightOverlayProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!pulse) return
    ref.current?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "center",
    })
    ref.current?.focus({ preventScroll: true })
  }, [pulse, shouldReduceMotion])

  return (
    <motion.button
      ref={ref}
      id={id}
      type="button"
      title={label}
      aria-label={label}
      data-bbox={`${bbox.x},${bbox.y},${bbox.w},${bbox.h}`}
      animate={pulse && !shouldReduceMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={cn(
        "w-full rounded-[2px] p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        STATE_HIGHLIGHT_CLASS[state],
        STATE_TEXT_CLASS[state],
        className
      )}
    >
      {children}
    </motion.button>
  )
}

export default HighlightOverlay
