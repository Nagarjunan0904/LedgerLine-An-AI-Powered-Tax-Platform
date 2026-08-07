import { cva, type VariantProps } from "class-variance-authority"

/**
 * Every FieldState is carried by three independent channels — border treatment,
 * fill tint, and (in FieldBox) a corner marker icon — so state survives greyscale
 * and doesn't rely on color alone. Colors come from the --state-* tokens in
 * src/index.css; nothing here is a hardcoded value.
 *
 * Border styles are deliberately not 1:1 with states (there are only 4 CSS border
 * styles for 5 states): verified and editable both read as solid, settled boxes.
 * They stay distinguishable because their fill/text tokens and marker icons differ.
 */
export const fieldVariants = cva(
  "group/field relative flex flex-col rounded-sm outline-none transition-colors",
  {
    variants: {
      state: {
        "ai-suggested":
          "border border-dashed border-state-ai-suggested-border bg-state-ai-suggested-fill text-state-ai-suggested-text",
        "needs-review":
          "border-4 border-double border-state-needs-review-border bg-state-needs-review-fill text-state-needs-review-text",
        verified:
          "border-2 border-solid border-state-verified-border bg-state-verified-fill text-state-verified-text",
        editable:
          "border border-solid border-state-editable-border bg-state-editable-fill text-state-editable-text",
        locked: "border-0 bg-state-locked-fill text-state-locked-text",
      },
      size: {
        sm: "min-w-40 gap-1 p-2",
        md: "min-w-56 gap-1.5 p-3",
        lg: "min-w-72 gap-2 p-4",
      },
      interactive: {
        true: "cursor-pointer hover:ring-1 hover:ring-ink/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        false: "",
      },
    },
    defaultVariants: {
      state: "editable",
      size: "md",
      interactive: false,
    },
  }
)

export type FieldVariants = VariantProps<typeof fieldVariants>
export type FieldSize = NonNullable<FieldVariants["size"]>

export const fieldLabelTextClass: Record<FieldSize, string> = {
  sm: "text-[0.6875rem]",
  md: "text-xs",
  lg: "text-xs",
}

export const fieldValueTextClass: Record<FieldSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
}

export const fieldMarkerSizeClass: Record<FieldSize, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-4.5",
}
