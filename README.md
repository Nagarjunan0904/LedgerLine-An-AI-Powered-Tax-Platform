# Ledgerline

**An AI-powered tax platform for CPAs and their clients.**

Live: **https://ledgerline-an-ai-powered-tax-platform-otsaqlgi9.vercel.app**
Repo: **https://github.com/Nagarjunan0904/LedgerLine-An-AI-Powered-Tax-Platform**

Built from scratch for the AI Engineer case study. All ten challenges, delivered as one product.

---

## What this is

A CPA reviewing a tax return has to trust every number in front of them. When software extracts a figure from a W-2 and drops it on Line 1a, the preparer has two bad options: take the software's word for it, or re-derive everything by hand — which defeats the point of the software. The same trust gap runs down the client side: a client who can't tell what the platform needs from them next just emails their CPA instead, and the whole workflow scatters.

The brief lists ten challenges. They're all versions of one question — **can this thing explain itself to the person looking at it right now?** — so I built one product rather than ten demos.

The thesis: **every number on a tax return should be able to explain itself.**

Two commitments follow from that:

**Provenance is a first-class object, not a tooltip.** In most tax software the link between a source document and a return field lives in someone's head or a paper workpaper. Here it's an entity with its own identity, state, and UI — which is why source traceability (01) and trustworthy AI (10) are the same feature built once, not two features built twice.

**One shell, many lenses.** A client and a senior reviewer see the same objects through different apertures, not different apps. Role changes what's surfaced and what's editable; it never changes where things live. That's what keeps six roles from splintering into six products.

---

## Try it

Four things worth clicking, in this order. Each is a deep link — panel state lives in the URL, so these restore exactly.

**1. The first-run client** → [`/home`](https://ledgerline-an-ai-powered-tax-platform-otsaqlgi9.vercel.app/home)
Switch the role picker (top right) to **Marcus Ellery**. One card, one action, everything else visibly deferred rather than hidden. Upload anything — a new task appears that's specifically about the document you just uploaded.

**2. The preparer's queue** → switch back to **Nadia Osei**
A ranked queue, not a chart wall. Every item shows *why* it ranked — deadline, severity, ownership, staleness, whether it unblocks other work.

**3. Traceability** → [`/returns/return-ellery-2025/review?field=1040-1a`](https://ledgerline-an-ai-powered-tax-platform-otsaqlgi9.vercel.app/returns/return-ellery-2025/review?field=1040-1a) ← **the core of the build**
Wages of $184,200. The chain shows the actual arithmetic and three W-2 sources. Click any source: it opens that document, highlights Box 1, and draws the connection. One source sits at 71% confidence and is flagged *before* you click it. Press **E** to open the AI's account of itself, then correct the low-confidence value and watch the total, the chain, and the document all move together.

**4. Scale** → [`/documents`](https://ledgerline-an-ai-powered-tax-platform-otsaqlgi9.vercel.app/documents)
420 documents. Search is fuzzy (try `ten99`), filters compose, and the filtered view is a shareable URL.

Also: [`/kitchen-sink`](https://ledgerline-an-ai-powered-tax-platform-otsaqlgi9.vercel.app/kitchen-sink) — the design system on its own, plus the staff-state → client-phase mapping table.

---

## Challenge coverage

| # | Challenge | Where it lives | Route |
|---|---|---|---|
| 01 | Source Document Traceability | Provenance chain + live connector to the source region | `/returns/:id/review?field=1040-1a` |
| 02 | Client & CPA Collaboration | Object-scoped threads, structural internal/client split | `/returns/:id/documents/:docId` |
| 03 | Where to Start | Three-state client home with progressive reveal | `/home` (client role) |
| 04 | Getting Lost | Route tree, context rail, object breadcrumbs, deep linking | every route |
| 05 | Role-Aware Experiences | Role switcher, capability table, dual-role context | header, every route |
| 06 | Return Status & Progress | Two-layer status model with a mapping fixed in code | `/returns/:id` · `/kitchen-sink` |
| 07 | An Actionable Dashboard | Explainable ranked queue | `/home` (staff role) |
| 08 | Clickable vs. Editable | `FieldBox` + `cva` variant system | `/kitchen-sink` and everywhere |
| 09 | Complexity Made Navigable | 420 documents, fuzzy search, composing filters, virtualized | `/documents` |
| 10 | Trustworthy AI | Explain drawer, confidence bands, correction flow with audit | `/returns/:id/review?explain=open` |

---

## What's real vs. simulated

**Genuinely wired:**

- Routing and deep linking — every panel is URL state, so any view is shareable and survives a refresh
- Role-based rendering and permissions, including the dual-role case
- The dashboard prioritization scoring, and the reasons it returns
- Fuzzy search, composing filters, grouping, and virtualization over the full 420-document dataset
- Provenance chain traversal, including multi-source sums and recursive derivation
- The correction flow, its audit trail, and the recalculation ripple through every consumer
- The status state machine and its many-to-one mapping
- Thread visibility filtering — internal threads are removed in the data layer, not hidden with CSS
- All interaction states: hover, focus, keyboard navigation, empty, error

**Simulated:**

- **Document extraction** — no OCR. Documents are HTML/SVG components styled as IRS forms, with authored bounding regions.
- **Confidence scores** — authored per fixture, not computed.
- **AI recommendations** — a stub behind a typed interface (`src/services/ai/`), with 300–900ms simulated latency and a deliberate ~1-in-20 failure rate so the error path is real.
- **Auth** — a role switcher, no credentials.
- **Persistence** — mutations live in Zustand and reset on reload. Deliberate: the brief asked for hardcoded data, and a real database would have cost time the interface needed.

---

## Decisions I'd defend

**Provenance as an entity, not a tooltip.** `Provenance` holds the whole chain — sources, transform steps, confidence, verification. Every hard question in the brief ("where did this come from", "can I edit it", "should I trust it", "who signed off") is answerable from that one shape, which is why challenges 01 and 10 collapsed into one build.

**Two-layer status.** "In Progress" means different things to different people because one label was serving two audiences. So there are two: nine internal staff states, five plain-language client phases, and a mapping fixed in code. Four staff states collapse into "Reviewing your return" — the client never learns which reviewer has it, because that isn't their problem.

**Blocking is a property, not a status.** A return is in `Preparation` **and** blocked — never `Blocked`. Making blocked a status destroys the information about where the work actually is.

**Color is the state system.** Every color in the palette means something: verified, AI-suggested, needs review, editable, locked. No decorative accent exists outside it. Each state is distinguishable three ways — border treatment, corner marker, fill — so it survives greyscale and video compression, not just colour vision.

**Panels are URL state, not component state.** Selected field, open source document, filters, drawer — all in the URL. "Send me that field" produces a link that actually works.

**No PDF library.** Mock documents render as HTML rather than PDFs. Bounding-box highlighting over a canvas-rendered PDF is genuinely fiddly, HTML stays crisp at any zoom, themes with the same tokens, and lets the highlighted region be a real focusable element the connector anchors to. Better *and* cheaper.

**Vite over Next.js.** Every component here is client-state-driven with no server data. App Router's RSC model would have been pure overhead.

**No tests.** Two days, and the brief grades the interface. Stating that plainly is more honest than quietly hoping nobody looks. Type safety is strict throughout and the fixture generator validates every cross-reference at build time.

**Built with Claude Code.** `CLAUDE.md` in the repo root is the architectural rulebook I held it to — Tailwind v4 constraints, the FieldBox rule, URL-state discipline, Zustand selector rules. Every phase was specified before it was built.

---

## How this would work in production

The stub in `src/services/ai/` defines the interface a real model would implement. Here's what would sit behind it.

**Extraction** is not one model. A layout-aware document model (LayoutLM-class, or a VLM with structured output) produces field candidates with regions. Those candidates are then validated against the known schema of the form — a W-2 has fixed boxes with known types and arithmetic relationships between them, and Box 3 ≤ the SS wage base is a hard constraint, not a suggestion. Most extraction errors are catchable this way before a human ever sees them. Failed validation routes to review rather than silently emitting a wrong number.

**Confidence needs calibration, not raw logprobs.** A model's token probability is not the probability that the field is correct, and presenting it as though it were is how you teach users to ignore the number. You need a held-out labelled set, per document type, and a calibration curve mapping raw scores onto observed accuracy — so that a displayed 0.71 actually means "wrong about three times in ten." Until that's measured, confidence bands ("worth checking") are more honest than a decimal, which is why the UI leads with the band and shows the number second.

**A vector store belongs in tax-code retrieval, not extraction.** Extraction is a structured-output problem over a known schema — embeddings add nothing. Where retrieval earns its place is the question behind the question: which code section governs this treatment, what changed this filing year, which prior-year position does this contradict. That's a RAG problem over IRS publications and the firm's own prior returns, and it's what would power a genuinely useful "why is this flagged" rather than a description of what the model saw.

**Corrections are the training signal.** The audit trail already captures the original value, the human correction, who made it, and when. That's a labelled example, and the "why was this wrong?" chip attaches a reason class to it. Aggregated, it tells you which document types and which boxes are failing, which is what drives the next round of fine-tuning and the next set of validation rules. A correction flow that discards the original value throws that away — which is why this one never does.

**What I'd resist building.** An AI that files the return. The value here is compressing review time while keeping the CPA accountable, and every design decision above serves that: the preparer stays the decision-maker and the software's job is to make itself checkable.

---

## Running locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run seed         # regenerate fixtures (seeded — deterministic)
npm run build        # typecheck + production build
```

Node 20+.

---

## Stack

React 19 · TypeScript (strict) · Vite · React Router v7 · Tailwind v4 · shadcn/ui (Radix) · Zustand · Fuse.js · TanStack Virtual · Motion · Faker (build-time only) · Vercel

**Deliberately absent:** backend, database, auth provider, persistence, OCR, i18n, analytics, tests.
