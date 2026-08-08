import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export interface ConnectorOverlayProps {
  /** DOM id of the chain row this line starts from. Null (or a row that isn't currently
   * mounted) means "nothing selected" — the overlay simply renders nothing. */
  fromId: string | null
  /** DOM id of the highlighted document region this line ends at — a HighlightOverlay's own
   * id (see components/documents/HighlightOverlay.tsx). Positioned purely via
   * getBoundingClientRect() on the two live elements; never a second coordinate system. */
  toId: string | null
  /** Tints the line to match what it's pointing at — a low-confidence source draws attention
   * to itself even in the connector, not just the row. */
  tone?: "neutral" | "flagged"
}

interface Point {
  x: number
  y: number
}

interface Anchors {
  p1: Point
  p2: Point
}

/** The point on `from`'s boundary closest to `to`'s center — so the line leaves whichever edge
 * actually faces the other element, regardless of whether the two are side by side or stacked. */
function anchorPoint(from: DOMRect, to: DOMRect): Point {
  const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 }
  const toCenter = { x: to.left + to.width / 2, y: to.top + to.height / 2 }
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: dx >= 0 ? from.right : from.left, y: fromCenter.y }
  }
  return { x: fromCenter.x, y: dy >= 0 ? from.bottom : from.top }
}

function pathBetween(p1: Point, p2: Point): string {
  const midX = (p1.x + p2.x) / 2
  return `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`
}

const TONE_CLASS: Record<NonNullable<ConnectorOverlayProps["tone"]>, string> = {
  neutral: "text-ink/50",
  flagged: "text-state-needs-review-border",
}

/**
 * The signature interaction, drawn: a line from the chain row someone clicked to the exact
 * document region it came from. Fixed-position full-viewport SVG so its coordinate space is
 * getBoundingClientRect()'s own — no separate layout math, no bbox.
 *
 * Position updates during scroll/resize deliberately bypass React. A setState there still
 * lands a render (and the commit that actually mutates the DOM) one tick after the rAF
 * callback that measured it — often after the browser has already painted the new scroll
 * position, which is what reads as the line trailing. So React state here drives only the two
 * events that are actually discrete: mounting, and the selection (fromId/toId) changing —
 * both of which want the full path/circle elements to re-key and replay their entrance
 * animation. Every in-between frame, while scrolling, mutates the already-mounted path and
 * circle attributes directly via refs, inside the same rAF callback that measured them, so the
 * update lands in the same frame — no render, no commit, no lag.
 */
export function ConnectorOverlay({ fromId, toId, tone = "neutral" }: ConnectorOverlayProps) {
  const [anchors, setAnchors] = useState<Anchors | null>(null)
  const shouldReduceMotion = useReducedMotion()
  const pathRef = useRef<SVGPathElement>(null)
  const p1Ref = useRef<SVGCircleElement>(null)
  const p2Ref = useRef<SVGCircleElement>(null)
  const frameRef = useRef<number | null>(null)

  const measure = useCallback((): Anchors | null => {
    if (!fromId || !toId) return null
    const fromEl = document.getElementById(fromId)
    const toEl = document.getElementById(toId)
    if (!fromEl || !toEl) return null
    const fromRect = fromEl.getBoundingClientRect()
    const toRect = toEl.getBoundingClientRect()
    return { p1: anchorPoint(fromRect, toRect), p2: anchorPoint(toRect, fromRect) }
  }, [fromId, toId])

  // Mount + selection change only. Deferred a frame (rather than called synchronously in the
  // effect body) so the elements a fresh selection just mounted are measurable, and so the
  // setState here happens inside a callback rather than the effect's own execution.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnchors(measure()))
    return () => cancelAnimationFrame(frame)
  }, [measure])

  // Scroll + resize. rAF-throttled (a pending frame absorbs any further calls before it runs —
  // never a debounce, which would make the line visibly trail during a fast scroll) and, once
  // the frame arrives, applied straight to the DOM instead of through setState.
  const scheduleReposition = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const next = measure()
      if (!next || !pathRef.current || !p1Ref.current || !p2Ref.current) return
      pathRef.current.setAttribute("d", pathBetween(next.p1, next.p2))
      p1Ref.current.setAttribute("cx", String(next.p1.x))
      p1Ref.current.setAttribute("cy", String(next.p1.y))
      p2Ref.current.setAttribute("cx", String(next.p2.x))
      p2Ref.current.setAttribute("cy", String(next.p2.y))
    })
  }, [measure])

  useEffect(() => {
    window.addEventListener("scroll", scheduleReposition, true)
    window.addEventListener("resize", scheduleReposition)
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      window.removeEventListener("scroll", scheduleReposition, true)
      window.removeEventListener("resize", scheduleReposition)
    }
  }, [scheduleReposition])

  if (!anchors) return null

  const { p1, p2 } = anchors
  const path = pathBetween(p1, p2)

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 z-40 h-screen w-screen", TONE_CLASS[tone])}
    >
      <motion.path
        ref={pathRef}
        key={`${fromId}-${toId}`}
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={{ pathLength: shouldReduceMotion ? 1 : 0, opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.55, ease: "easeInOut" }}
      />
      <motion.circle
        ref={p1Ref}
        key={`${fromId}-${toId}-p1`}
        cx={p1.x}
        cy={p1.y}
        r={3}
        fill="currentColor"
        initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: shouldReduceMotion ? 0 : 0.15, duration: 0.25 }}
      />
      <motion.circle
        ref={p2Ref}
        key={`${fromId}-${toId}-p2`}
        cx={p2.x}
        cy={p2.y}
        r={3}
        fill="currentColor"
        initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: shouldReduceMotion ? 0 : 0.45, duration: 0.25 }}
      />
    </svg>
  )
}

export default ConnectorOverlay
