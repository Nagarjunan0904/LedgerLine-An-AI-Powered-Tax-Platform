# Ledgerline — Project Rules

## What this is
A prototype tax platform for a case study. Frontend only. No backend, no
database, no auth, no network calls. All data comes from typed fixtures in
src/data/. Mutations live in Zustand and reset on reload. This is intentional
and is documented in the README as a deliberate tradeoff.

## Stack (already installed — do not add to this without asking)
React 19 · TypeScript · Vite 8 · React Router v7 · Tailwind v4 · shadcn/ui
(Radix primitives) · Zustand · Fuse.js · TanStack Virtual · date-fns · motion
· lucide-react · Faker (dev only)

## Non-negotiables
- Tailwind v4: tokens go in the @theme block in src/index.css.
  NEVER create tailwind.config.js. It does not exist in v4.
- Every number rendered in the UI uses the mono font + tabular-nums.
- Every value with a state uses <FieldBox>. Never hand-roll field styling.
- Every panel that can be open is URL state (useSearchParams), not useState.
- Path alias is @/ → src/. Use it; no ../../ imports.
- TypeScript strict. No `any`. The types in src/types/ are the contract.
- No new dependencies without asking first.

## Voice
Sentence case. Active voice. Buttons say what happens ("Approve value", not
"Submit"). Empty states are invitations, not apologies.

## Where things live
src/types/      the object model — the contract for everything else
src/data/       seeded fixtures + the generator script
src/lib/        pure logic: prioritize, provenance, status, permissions, search
src/services/ai/ typed AI interfaces + stub implementations
src/components/ UI, grouped by domain
src/pages/      route components