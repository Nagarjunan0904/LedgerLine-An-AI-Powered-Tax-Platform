/**
 * Deterministic demo-data generator. Run via `npm run seed` (plain `node`, no build step —
 * this project's tsconfig restricts TS syntax to what Node can strip natively).
 *
 * Every random choice goes through the seeded `faker` instance below, and every date is
 * computed from the fixed `NOW` constant. No Math.random, no Date.now(), no bare `new Date()`
 * with no arguments — a demo dataset that shifts between rehearsal and recording is a demo
 * that fails.
 *
 * Output: one JSON file per collection, written into this directory. fixtures.ts is the only
 * thing that should import them directly; everything else should import fixtures.ts.
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { faker } from "@faker-js/faker"

import type {
  User,
  UserRef,
  Return,
  ClientPhase,
  StaffState,
  Blocker,
  ReturnField,
  AuditEntry,
  FieldState,
  Document,
  DocumentType,
  BBox,
  ExtractedField,
  Provenance,
  TransformStep,
  ProvenanceMethod,
  OpenItem,
  Severity,
  ObjectRef,
  Thread,
  Message,
  QuestionnaireItem,
  AnswerType,
} from "../types/index.ts"

import { DEMO_IDS } from "./demoIds.ts"

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

/** Fixed seed — do not change. The whole point is a dataset that's identical every run. */
const SEED = 8675309
faker.seed(SEED)

/** Fixed "now". Every relative date in this dataset is computed from this, never from the clock. */
const NOW = new Date("2026-08-07T12:00:00.000Z")

function daysFrom(base: Date, days: number): string {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pick<T>(arr: readonly T[]): T {
  return faker.helpers.arrayElement(arr)
}

function idFactory(prefix: string) {
  let n = 0
  return () => `${prefix}-${String(++n).padStart(4, "0")}`
}

const nextUserId = idFactory("user")
const nextReturnId = idFactory("return")
const nextDocId = idFactory("doc")
const nextExtId = idFactory("ext")
const nextFieldId = idFactory("field")
const nextProvId = idFactory("prov")
const nextItemId = idFactory("item")
const nextThreadId = idFactory("thread")
const nextMsgId = idFactory("msg")
const nextQId = idFactory("qi")
const nextAuditId = idFactory("audit")
const nextBlockerId = idFactory("blocker")

/**
 * ~15% of confidences fall below 0.80, spanning down to 0.42. A dataset where everything
 * is 95% doesn't test the trust UI — this is the one knob that matters most in this file.
 */
function sampleConfidence(): number {
  const isLow = faker.number.float({ min: 0, max: 1, fractionDigits: 4 }) < 0.15
  return isLow
    ? round2(faker.number.float({ min: 0.42, max: 0.79, fractionDigits: 2 }))
    : round2(faker.number.float({ min: 0.8, max: 0.99, fractionDigits: 2 }))
}

/**
 * Distributes `total` across `count` buckets, each within [min, max], summing to exactly
 * `total`. Used everywhere a volume target ("420 documents", "120 open items") has to be
 * hit exactly while individual counts still look randomized.
 */
function allocateExact(total: number, count: number, min: number, max: number): number[] {
  const raw = Array.from({ length: count }, () => faker.number.int({ min, max }))
  const rawSum = raw.reduce((a, b) => a + b, 0)
  const scale = rawSum === 0 ? 0 : total / rawSum
  const scaled = raw.map((n) => Math.max(min, Math.round(n * scale)))
  let diff = total - scaled.reduce((a, b) => a + b, 0)
  let guard = 0
  while (diff !== 0 && guard < 20000) {
    const idx = faker.number.int({ min: 0, max: count - 1 })
    if (diff > 0) {
      scaled[idx]++
      diff--
    } else if (scaled[idx] > min) {
      scaled[idx]--
      diff++
    }
    guard++
  }
  return scaled
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const users: User[] = []
const returns: Return[] = []
const documents: Document[] = []
const extractedFields: ExtractedField[] = []
const fields: ReturnField[] = []
const provenance: Provenance[] = []
const openItems: OpenItem[] = []
const threads: Thread[] = []
const questionnaireItems: QuestionnaireItem[] = []

function addUser(u: User): User {
  users.push(u)
  return u
}
function addReturn(r: Return): Return {
  returns.push(r)
  return r
}
function addDoc(d: Document): Document {
  documents.push(d)
  return d
}
function addExtracted(e: ExtractedField): ExtractedField {
  extractedFields.push(e)
  return e
}
function addField(f: ReturnField): ReturnField {
  fields.push(f)
  return f
}
function addProvenance(p: Provenance): Provenance {
  provenance.push(p)
  return p
}
function addOpenItem(i: OpenItem): OpenItem {
  openItems.push(i)
  return i
}
function addThread(t: Thread): Thread {
  threads.push(t)
  return t
}
function addQuestionnaireItem(q: QuestionnaireItem): QuestionnaireItem {
  questionnaireItems.push(q)
  return q
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function personEmail(name: string, domain?: string): string {
  const [first, ...rest] = name.split(" ")
  const last = rest.length > 0 ? rest[rest.length - 1] : "user"
  return faker.internet.email({ firstName: first, lastName: last, provider: domain }).toLowerCase()
}

/** First + last only. faker.person.fullName() occasionally prepends a prefix ("Mr.") or
 * appends a suffix ("PhD", "III", "I") — returnLabel takes the last whitespace-separated
 * token as the surname, so a suffix there renders as e.g. "I 2025" instead of a real name. */
function personName(): string {
  return `${faker.person.firstName()} ${faker.person.lastName()}`
}

const marcus = addUser({
  id: DEMO_IDS.MARCUS_ELLERY_USER,
  name: "Marcus Ellery",
  email: "marcus.ellery@example.com",
  kind: "client",
})

const nadia = addUser({
  id: DEMO_IDS.NADIA_OSEI_USER,
  name: "Nadia Osei",
  email: "nadia.osei@ledgerline.example",
  kind: "staff",
})

const renataBloom = addUser({
  id: "user-renata-bloom",
  name: "Renata Bloom",
  email: "renata.bloom@example.com",
  kind: "client",
})
const desmondWhitfield = addUser({
  id: "user-desmond-whitfield",
  name: "Desmond Whitfield",
  email: "desmond.whitfield@example.com",
  kind: "client",
})
const priyaVoss = addUser({
  id: "user-priya-voss",
  name: "Priya Voss",
  email: "priya.voss@example.com",
  kind: "client",
})

/**
 * Role (individual/preparer/reviewer/...) isn't tracked per-user in the type contract —
 * User only carries `kind`. These are generic staff accounts used as assignedTo/uploadedBy/
 * verifiedBy across the dataset.
 */
const staffUsers: User[] = []
for (let i = 0; i < 11; i++) {
  const name = personName()
  staffUsers.push(
    addUser({
      id: nextUserId(),
      name,
      email: personEmail(name, "ledgerline.example"),
      kind: "staff",
    })
  )
}
/** Preparer who handles Nadia's own personal return — a firm wouldn't have her review herself. */
const colleaguePreparer = staffUsers[0]
const allStaff = [nadia, ...staffUsers]

const clientUsers: User[] = []
for (let i = 0; i < 54; i++) {
  const name = personName()
  clientUsers.push(
    addUser({
      id: nextUserId(),
      name,
      email: personEmail(name),
      kind: "client",
    })
  )
}

// ---------------------------------------------------------------------------
// Returns — the 6 named/edge-case returns first, then 54 generic ones
// ---------------------------------------------------------------------------

// Case 1 — THE demo return: 1040-1a Wages, summed from three W-2s
const elleryReturn = addReturn({
  id: DEMO_IDS.ELLERY_RETURN,
  clientId: marcus.id,
  clientName: marcus.name,
  taxYear: 2025,
  clientPhase: "reviewing",
  staffState: "extraction-review",
  ownerRole: "firm",
  assignedTo: nadia.id,
  // On extension — explains why a 2025 return is still active in August 2026.
  dueDate: "2026-10-15T00:00:00.000Z",
  blockers: [],
})

// Case 6 — brand-new client, no documents (first-run state). Same client, a fresh engagement.
const elleryFirstRunReturn = addReturn({
  id: DEMO_IDS.ELLERY_RETURN_FIRST_RUN,
  clientId: marcus.id,
  clientName: marcus.name,
  taxYear: 2026,
  clientPhase: "gathering-documents",
  staffState: "intake",
  ownerRole: "firm",
  assignedTo: nadia.id,
  dueDate: "2027-04-15T00:00:00.000Z",
  blockers: [],
})

// These three exist in the fixture from the start, not created by the upload itself — only
// the Document comes from ClientHome's fake-upload flow. They stay invisible to the
// onboarding-stage derivation while document count is zero (State A shows one card, nothing
// else), then become the client's queue the moment a document exists — State A → B, not
// straight to "onboarding complete."
addQuestionnaireItem({
  id: DEMO_IDS.ELLERY_FIRST_RUN_W2_QUESTION,
  returnId: elleryFirstRunReturn.id,
  sectionId: "income",
  question: "Is the W-2 you uploaded from your primary employer?",
  answerType: "boolean",
  answer: null,
  required: true,
})
addOpenItem({
  id: DEMO_IDS.ELLERY_FIRST_RUN_SECOND_DOC_ITEM,
  returnId: elleryFirstRunReturn.id,
  title: "Upload your 1099-INT, if you have one",
  description:
    "If you earned interest from a bank or investment account this year, upload the 1099-INT for it.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, 21),
  severity: "medium",
  linkedObjects: [],
  resolvedAt: null,
})
addOpenItem({
  id: DEMO_IDS.ELLERY_FIRST_RUN_ADDRESS_ITEM,
  returnId: elleryFirstRunReturn.id,
  title: "Confirm your current mailing address",
  description: "Confirm the mailing address we have on file is still correct for this tax year.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, 14),
  severity: "low",
  linkedObjects: [],
  resolvedAt: null,
})

// Case 5 — zero open items (empty state), otherwise a normal, wrapped-up return
const bloomReturn = addReturn({
  id: DEMO_IDS.BLOOM_RETURN,
  clientId: renataBloom.id,
  clientName: renataBloom.name,
  taxYear: 2025,
  clientPhase: "ready-to-sign",
  staffState: "client-signature",
  ownerRole: "firm",
  assignedTo: staffUsers[1].id,
  dueDate: "2026-04-15T00:00:00.000Z",
  blockers: [],
})

// Case 7 — e-filed, fully locked (read-only affordance)
const whitfieldReturn = addReturn({
  id: DEMO_IDS.WHITFIELD_RETURN,
  clientId: desmondWhitfield.id,
  clientName: desmondWhitfield.name,
  taxYear: 2024,
  clientPhase: "filed",
  staffState: "e-filed",
  ownerRole: "firm",
  assignedTo: staffUsers[2].id,
  dueDate: "2025-04-15T00:00:00.000Z",
  blockers: [],
})

// Case 9 — blocked, but staffState stays "preparation". Blocking is not a status.
const vossReturn = addReturn({
  id: DEMO_IDS.VOSS_RETURN,
  clientId: priyaVoss.id,
  clientName: priyaVoss.name,
  taxYear: 2025,
  clientPhase: "reviewing",
  staffState: "preparation",
  ownerRole: "firm",
  assignedTo: staffUsers[3].id,
  dueDate: "2026-10-15T00:00:00.000Z",
  blockers: [
    {
      id: DEMO_IDS.VOSS_BLOCKER,
      reason:
        "Waiting on a missing Schedule K-1 from Voss Consulting LLC before business income can be finalized.",
      owner: "client",
      since: daysFrom(NOW, -9),
    },
  ],
})

// Case 10 — Nadia Osei's own personal return (dual role: preparer and client)
const nadiaPersonalReturn = addReturn({
  id: DEMO_IDS.NADIA_OSEI_PERSONAL_RETURN,
  clientId: nadia.id,
  clientName: nadia.name,
  taxYear: 2025,
  clientPhase: "reviewing",
  staffState: "preparation",
  ownerRole: "client",
  assignedTo: colleaguePreparer.id,
  dueDate: "2026-10-15T00:00:00.000Z",
  blockers: [],
})

const STATE_PAIRS: { staffState: StaffState; clientPhase: ClientPhase; weight: number }[] = [
  { staffState: "intake", clientPhase: "gathering-documents", weight: 2 },
  { staffState: "docs-pending", clientPhase: "gathering-documents", weight: 2 },
  { staffState: "extraction-review", clientPhase: "reviewing", weight: 3 },
  { staffState: "preparation", clientPhase: "reviewing", weight: 3 },
  { staffState: "open-items", clientPhase: "needs-your-answer", weight: 2 },
  { staffState: "manager-review", clientPhase: "reviewing", weight: 2 },
  { staffState: "partner-review", clientPhase: "reviewing", weight: 1 },
  { staffState: "client-signature", clientPhase: "ready-to-sign", weight: 2 },
  { staffState: "e-filed", clientPhase: "filed", weight: 4 },
]

const BLOCKER_REASONS = [
  "Waiting on a missing Schedule K-1 from a business partner.",
  "Client hasn't responded to an open item request in over a week.",
  "Awaiting a signed Form 8879 before the return can be transmitted.",
  "Missing prior-year AGI needed for e-file identity verification.",
  "Waiting on a corrected W-2 from the client's employer.",
  "Client's bank hasn't issued a corrected 1099 yet.",
]

const genericReturns: Return[] = []
for (let i = 0; i < 54; i++) {
  const client = clientUsers[i]
  const taxYear = faker.helpers.weightedArrayElement([
    { weight: 7, value: 2025 },
    { weight: 3, value: 2024 },
  ])
  const pair = faker.helpers.weightedArrayElement(
    STATE_PAIRS.map((p) => ({ weight: p.weight, value: p }))
  )
  const extended = faker.datatype.boolean(0.25)
  const dueDate =
    taxYear === 2025
      ? extended
        ? "2026-10-15T00:00:00.000Z"
        : "2026-04-15T00:00:00.000Z"
      : extended
        ? "2025-10-15T00:00:00.000Z"
        : "2025-04-15T00:00:00.000Z"
  const assignedTo =
    pair.staffState === "intake" && faker.datatype.boolean(0.4) ? null : pick(allStaff).id
  const hasBlocker = pair.staffState !== "e-filed" && faker.datatype.boolean(0.15)
  const blockers: Blocker[] = hasBlocker
    ? [
        {
          id: nextBlockerId(),
          reason: pick(BLOCKER_REASONS),
          owner: faker.helpers.weightedArrayElement([
            { weight: 2, value: "client" as const },
            { weight: 1, value: "firm" as const },
          ]),
          since: daysFrom(NOW, -faker.number.int({ min: 1, max: 30 })),
        },
      ]
    : []

  const r = addReturn({
    id: nextReturnId(),
    clientId: client.id,
    clientName: client.name,
    taxYear,
    clientPhase: pair.clientPhase,
    staffState: pair.staffState,
    ownerRole: faker.datatype.boolean(0.05) ? "client" : "firm",
    assignedTo,
    dueDate,
    blockers,
  })
  genericReturns.push(r)
}

// ---------------------------------------------------------------------------
// Documents + ExtractedFields
// ---------------------------------------------------------------------------

const DOC_TYPES: { weight: number; value: DocumentType }[] = [
  { weight: 25, value: "W-2" },
  { weight: 15, value: "1099-INT" },
  { weight: 10, value: "1099-DIV" },
  { weight: 10, value: "1099-B" },
  { weight: 8, value: "K-1" },
  { weight: 10, value: "1098" },
  { weight: 12, value: "receipt" },
  { weight: 10, value: "other" },
]

function makeFileName(type: DocumentType, taxYear: number, payer?: string): string {
  const who = payer ?? faker.company.name()
  switch (type) {
    case "W-2":
      return `${who} W-2 ${taxYear}.pdf`
    case "1099-INT":
      return `${who} 1099-INT ${taxYear}.pdf`
    case "1099-DIV":
      return `${who} 1099-DIV ${taxYear}.pdf`
    case "1099-B":
      return `${who} 1099-B ${taxYear}.pdf`
    case "K-1":
      return `${who} Schedule K-1 ${taxYear}.pdf`
    case "1098":
      return `${who} Form 1098 ${taxYear}.pdf`
    case "receipt":
      return `Receipt — ${faker.commerce.department()} (${who}).jpg`
    case "other":
      return `${who} document ${taxYear}.pdf`
  }
}

function pageCountFor(type: DocumentType): number {
  if (type === "1099-B") return faker.number.int({ min: 1, max: 3 })
  if (type === "K-1") return faker.number.int({ min: 1, max: 3 })
  if (type === "receipt" || type === "other") return faker.datatype.boolean(0.15) ? 2 : 1
  return 1
}

function boxLabelFor(type: DocumentType): string {
  switch (type) {
    case "W-2":
      return "Box 1 — Wages, tips, other compensation"
    case "1099-INT":
      return "Box 1 — Interest income"
    case "1099-DIV":
      return "Box 1a — Total ordinary dividends"
    case "1099-B":
      return "Column (e) — Cost basis"
    case "K-1":
      return "Box 1 — Ordinary business income"
    case "1098":
      return "Box 1 — Mortgage interest received"
    case "receipt":
      return "Total amount"
    case "other":
      return "Reported amount"
  }
}

function amountRangeFor(type: DocumentType): [number, number] {
  switch (type) {
    case "W-2":
      return [18000, 210000]
    case "1099-INT":
      return [5, 3200]
    case "1099-DIV":
      return [0, 6500]
    case "1099-B":
      return [200, 45000]
    case "K-1":
      return [-8000, 60000]
    case "1098":
      return [400, 22000]
    case "receipt":
      return [10, 4000]
    case "other":
      return [10, 8000]
  }
}

function randomBBox(): BBox {
  return {
    x: round2(faker.number.float({ min: 0.08, max: 0.6, fractionDigits: 2 })),
    y: round2(faker.number.float({ min: 0.1, max: 0.85, fractionDigits: 2 })),
    w: round2(faker.number.float({ min: 0.15, max: 0.35, fractionDigits: 2 })),
    h: round2(faker.number.float({ min: 0.02, max: 0.05, fractionDigits: 2 })),
  }
}

function money(n: number): string {
  return n < 0
    ? `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** returnId -> ExtractedFields belonging to documents on that return. Field generation reads this. */
const extractedByReturn = new Map<string, ExtractedField[]>()
function trackExtracted(returnId: string, ext: ExtractedField) {
  const list = extractedByReturn.get(returnId) ?? []
  list.push(ext)
  extractedByReturn.set(returnId, list)
}

/** Generates a normal (non-demo-scripted) document + up to one ExtractedField for it. */
function generateDocument(ret: Return): Document {
  const type = faker.helpers.weightedArrayElement(DOC_TYPES)
  const status = faker.helpers.weightedArrayElement([
    { weight: 75, value: "complete" as const },
    { weight: 10, value: "partial" as const },
    { weight: 8, value: "pending" as const },
    { weight: 7, value: "failed" as const },
  ])
  const uploader =
    ret.assignedTo && faker.datatype.boolean(0.15) ? ret.assignedTo : ret.clientId
  const doc = addDoc({
    id: nextDocId(),
    returnId: ret.id,
    type,
    fileName: makeFileName(type, ret.taxYear),
    pageCount: pageCountFor(type),
    uploadedBy: uploader,
    uploadedAt: daysFrom(NOW, -faker.number.int({ min: 3, max: 120 })),
    extractionStatus: status,
  })

  if (status === "complete" || status === "partial") {
    const [min, max] = amountRangeFor(type)
    const amount = round2(faker.number.float({ min, max, fractionDigits: 2 }))
    const ext = addExtracted({
      id: nextExtId(),
      documentId: doc.id,
      page: faker.number.int({ min: 1, max: doc.pageCount }),
      bbox: randomBBox(),
      label: boxLabelFor(type),
      rawValue: money(amount),
      // Both 'complete' and 'partial' go through the same weighted sampler — a hardcoded
      // always-low range here for 'partial' skewed the overall confidence distribution
      // well past the ~15%-below-0.80 target.
      confidence: sampleConfidence(),
    })
    trackExtracted(ret.id, ext)
  }
  return doc
}

// --- Case 1: three W-2 sources summing into Ellery's Wages field --------------------------

const elleryW2Sources: { docId: string; extId: string; fileName: string; amount: number; confidence: number }[] = [
  { docId: DEMO_IDS.ELLERY_W2_ACME_DOC, extId: DEMO_IDS.ELLERY_W2_ACME_EXTRACTED, fileName: "Acme Corp W-2 2025.pdf", amount: 96400, confidence: 0.98 },
  { docId: DEMO_IDS.ELLERY_W2_BELMONT_DOC, extId: DEMO_IDS.ELLERY_W2_BELMONT_EXTRACTED, fileName: "Belmont LLC W-2 2025.pdf", amount: 61300, confidence: 0.94 },
  // The flagged source — confidence 0.71 drags the whole summed field down with it.
  { docId: DEMO_IDS.ELLERY_W2_CORVID_DOC, extId: DEMO_IDS.ELLERY_W2_CORVID_EXTRACTED, fileName: "Corvid Inc W-2 2025.pdf", amount: 26500, confidence: 0.71 },
]
elleryW2Sources.forEach((source, i) => {
  addDoc({
    id: source.docId,
    returnId: elleryReturn.id,
    type: "W-2",
    fileName: source.fileName,
    pageCount: 1,
    uploadedBy: marcus.id,
    uploadedAt: daysFrom(NOW, -34 + i),
    extractionStatus: "complete",
  })
  const ext = addExtracted({
    id: source.extId,
    documentId: source.docId,
    page: 1,
    bbox: { x: 0.62, y: round2(0.21 + i * 0.01), w: 0.3, h: 0.045 },
    label: "Box 1 — Wages, tips, other compensation",
    rawValue: money(source.amount),
    confidence: source.confidence,
  })
  trackExtracted(elleryReturn.id, ext)
})

addField({
  id: DEMO_IDS.ELLERY_WAGES_FIELD,
  returnId: elleryReturn.id,
  formLine: "1040-1a",
  label: "Wages, salaries, tips, etc. (Form 1040, line 1a)",
  value: 184200,
  state: "needs-review",
  provenanceId: DEMO_IDS.ELLERY_WAGES_PROVENANCE,
  audit: [],
})
addProvenance({
  id: DEMO_IDS.ELLERY_WAGES_PROVENANCE,
  targetFieldId: DEMO_IDS.ELLERY_WAGES_FIELD,
  sourceFieldIds: elleryW2Sources.map((s) => s.extId),
  transform: [{ op: "sum", sourceIds: elleryW2Sources.map((s) => s.extId) }],
  // A sum is only as trustworthy as its weakest input.
  confidence: Math.min(...elleryW2Sources.map((s) => s.confidence)),
  method: "derived",
  verification: null,
})

// --- Case 2: AI misread a 1099-INT; a preparer corrected it; audit trail intact -----------

addDoc({
  id: DEMO_IDS.ELLERY_INTEREST_DOC,
  returnId: elleryReturn.id,
  type: "1099-INT",
  fileName: "First Capital Bank 1099-INT 2025.pdf",
  pageCount: 1,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -30),
  extractionStatus: "complete",
})
const elleryInterestExtracted = addExtracted({
  id: DEMO_IDS.ELLERY_INTEREST_EXTRACTED,
  documentId: DEMO_IDS.ELLERY_INTEREST_DOC,
  page: 1,
  bbox: { x: 0.58, y: 0.34, w: 0.22, h: 0.04 },
  label: "Box 1 — Interest income",
  // The AI transposed two digits reading this — a realistic OCR failure mode.
  rawValue: "$842.10",
  confidence: 0.86,
})
trackExtracted(elleryReturn.id, elleryInterestExtracted)

const interestCorrectionAt = daysFrom(NOW, -26)
addField({
  id: DEMO_IDS.ELLERY_INTEREST_FIELD,
  returnId: elleryReturn.id,
  formLine: "Sch B-2",
  label: "Taxable interest (Schedule B, line 2)",
  value: 824.1,
  state: "verified",
  provenanceId: DEMO_IDS.ELLERY_INTEREST_PROVENANCE,
  audit: [
    {
      id: nextAuditId(),
      fieldId: DEMO_IDS.ELLERY_INTEREST_FIELD,
      at: interestCorrectionAt,
      by: nadia.id,
      previousValue: 842.1,
      newValue: 824.1,
      previousState: "ai-suggested",
      newState: "verified",
    },
  ],
})
addProvenance({
  id: DEMO_IDS.ELLERY_INTEREST_PROVENANCE,
  targetFieldId: DEMO_IDS.ELLERY_INTEREST_FIELD,
  sourceFieldIds: [DEMO_IDS.ELLERY_INTEREST_EXTRACTED],
  transform: [{ op: "direct", sourceId: DEMO_IDS.ELLERY_INTEREST_EXTRACTED }],
  // Original (wrong) OCR confidence — high confidence doesn't guarantee correctness.
  confidence: 0.86,
  method: "extracted",
  verification: { by: nadia.id, at: interestCorrectionAt },
})

// --- Case 3: two 1099-INTs from the same payer, conflicting amounts -----------------------

addDoc({
  id: DEMO_IDS.ELLERY_1099INT_REGIONAL_A_DOC,
  returnId: elleryReturn.id,
  type: "1099-INT",
  fileName: "Regional Community Bank 1099-INT 2025 (upload 1).pdf",
  pageCount: 1,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -28),
  extractionStatus: "complete",
})
addDoc({
  id: DEMO_IDS.ELLERY_1099INT_REGIONAL_B_DOC,
  returnId: elleryReturn.id,
  type: "1099-INT",
  fileName: "Regional Community Bank 1099-INT 2025 (upload 2).pdf",
  pageCount: 1,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -12),
  extractionStatus: "complete",
})
trackExtracted(
  elleryReturn.id,
  addExtracted({
    id: DEMO_IDS.ELLERY_1099INT_REGIONAL_A_EXTRACTED,
    documentId: DEMO_IDS.ELLERY_1099INT_REGIONAL_A_DOC,
    page: 1,
    bbox: { x: 0.58, y: 0.34, w: 0.22, h: 0.04 },
    label: "Box 1 — Interest income",
    rawValue: "$412.50",
    confidence: 0.95,
  })
)
trackExtracted(
  elleryReturn.id,
  addExtracted({
    id: DEMO_IDS.ELLERY_1099INT_REGIONAL_B_EXTRACTED,
    documentId: DEMO_IDS.ELLERY_1099INT_REGIONAL_B_DOC,
    page: 1,
    bbox: { x: 0.58, y: 0.35, w: 0.22, h: 0.04 },
    label: "Box 1 — Interest income",
    rawValue: "$458.90",
    confidence: 0.91,
  })
)
addOpenItem({
  id: DEMO_IDS.ELLERY_CONFLICTING_1099_OPEN_ITEM,
  returnId: elleryReturn.id,
  title: "Confirm correct 1099-INT amount from Regional Community Bank",
  description:
    "Two 1099-INT forms were uploaded from the same payer with different amounts ($412.50 vs. $458.90). Confirm with the client which is correct — or whether one is a corrected reissue — before totaling interest income.",
  owner: "firm",
  assignedTo: nadia.id,
  dueDate: daysFrom(NOW, 5),
  severity: "high",
  linkedObjects: [
    { type: "document", id: DEMO_IDS.ELLERY_1099INT_REGIONAL_A_DOC },
    { type: "document", id: DEMO_IDS.ELLERY_1099INT_REGIONAL_B_DOC },
  ],
  resolvedAt: null,
})

// --- Case 4: extraction failed entirely ----------------------------------------------------

addDoc({
  id: DEMO_IDS.ELLERY_FAILED_EXTRACTION_DOC,
  returnId: elleryReturn.id,
  type: "receipt",
  fileName: "Business expense receipt (photo, blurry).jpg",
  pageCount: 1,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -20),
  extractionStatus: "failed",
})
addOpenItem({
  id: DEMO_IDS.ELLERY_FAILED_EXTRACTION_OPEN_ITEM,
  returnId: elleryReturn.id,
  title: "Re-upload or manually enter the blurry expense receipt",
  description:
    "Automatic extraction failed on this receipt — the image is too blurry to read. Ask the client for a clearer photo, or enter the amount manually from the original.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, 7),
  severity: "medium",
  linkedObjects: [{ type: "document", id: DEMO_IDS.ELLERY_FAILED_EXTRACTION_DOC }],
  resolvedAt: null,
})

// --- Case 8: a field at confidence 0.44 — visibly alarming --------------------------------

addDoc({
  id: DEMO_IDS.ELLERY_ALARMING_DOC,
  returnId: elleryReturn.id,
  type: "1099-B",
  fileName: "Broker statement (handwritten cost basis note).pdf",
  pageCount: 2,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -15),
  extractionStatus: "partial",
})
const alarmingExtracted = addExtracted({
  id: DEMO_IDS.ELLERY_ALARMING_EXTRACTED,
  documentId: DEMO_IDS.ELLERY_ALARMING_DOC,
  page: 2,
  bbox: { x: 0.44, y: 0.61, w: 0.18, h: 0.03 },
  label: "Column (e) — Cost basis",
  rawValue: "$1,24_?.__ (handwritten, partially illegible)",
  confidence: 0.44,
})
trackExtracted(elleryReturn.id, alarmingExtracted)
addField({
  id: DEMO_IDS.ELLERY_ALARMING_FIELD,
  returnId: elleryReturn.id,
  formLine: "8949-e",
  label: "Cost basis (Form 8949, column e)",
  value: 1240,
  state: "ai-suggested",
  provenanceId: DEMO_IDS.ELLERY_ALARMING_PROVENANCE,
  audit: [],
})
addProvenance({
  id: DEMO_IDS.ELLERY_ALARMING_PROVENANCE,
  targetFieldId: DEMO_IDS.ELLERY_ALARMING_FIELD,
  sourceFieldIds: [DEMO_IDS.ELLERY_ALARMING_EXTRACTED],
  transform: [{ op: "direct", sourceId: DEMO_IDS.ELLERY_ALARMING_EXTRACTED }],
  confidence: 0.44,
  method: "extracted",
  verification: null,
})

// --- Ellery's remaining plain fields + documents, rounding the return out -----------------

const elleryDivDoc = addDoc({
  id: nextDocId(),
  returnId: elleryReturn.id,
  type: "1099-DIV",
  fileName: "Meridian Brokerage 1099-DIV 2025.pdf",
  pageCount: 1,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -22),
  extractionStatus: "complete",
})
const elleryDivExtracted = addExtracted({
  id: nextExtId(),
  documentId: elleryDivDoc.id,
  page: 1,
  bbox: { x: 0.55, y: 0.28, w: 0.22, h: 0.04 },
  label: "Box 1a — Total ordinary dividends",
  rawValue: "$1,904.00",
  confidence: 0.97,
})
trackExtracted(elleryReturn.id, elleryDivExtracted)

const elleryDivFieldId = nextFieldId()
const elleryDivProvId = nextProvId()
addField({
  id: elleryDivFieldId,
  returnId: elleryReturn.id,
  formLine: "1040-3b",
  label: "Ordinary dividends (Form 1040, line 3b)",
  value: 1904,
  state: "verified",
  provenanceId: elleryDivProvId,
  audit: [],
})
addProvenance({
  id: elleryDivProvId,
  targetFieldId: elleryDivFieldId,
  sourceFieldIds: [elleryDivExtracted.id],
  transform: [{ op: "direct", sourceId: elleryDivExtracted.id }],
  confidence: 0.97,
  method: "extracted",
  verification: { by: nadia.id, at: daysFrom(NOW, -21) },
})

const elleryFilingStatusFieldId = nextFieldId()
const elleryFilingStatusProvId = nextProvId()
addField({
  id: elleryFilingStatusFieldId,
  returnId: elleryReturn.id,
  formLine: "1040-filing-status",
  label: "Filing status",
  value: "Married filing jointly",
  state: "verified",
  provenanceId: elleryFilingStatusProvId,
  audit: [],
})
addProvenance({
  id: elleryFilingStatusProvId,
  targetFieldId: elleryFilingStatusFieldId,
  sourceFieldIds: [],
  transform: [{ op: "manual-entry", enteredBy: marcus.id, reason: "Provided directly by the client during intake." }],
  confidence: 1,
  method: "client-entered",
  verification: { by: nadia.id, at: daysFrom(NOW, -33) },
})

const elleryTotalTaxFieldId = nextFieldId()
const elleryTotalTaxProvId = nextProvId()
addField({
  id: elleryTotalTaxFieldId,
  returnId: elleryReturn.id,
  formLine: "1040-16",
  label: "Total tax (Form 1040, line 16)",
  value: 28650,
  // Depends on the still-unresolved wages figure upstream — will need another pass.
  state: "needs-review",
  provenanceId: elleryTotalTaxProvId,
  audit: [],
})
addProvenance({
  id: elleryTotalTaxProvId,
  targetFieldId: elleryTotalTaxFieldId,
  sourceFieldIds: [],
  transform: [{ op: "lookup", table: "2025-tax-tables", key: "MFJ:160000-190000" }],
  confidence: 0.9,
  method: "derived",
  verification: null,
})

// Two more plain documents for volume — never wired to a field, just sitting in the file list.
addDoc({
  id: nextDocId(),
  returnId: elleryReturn.id,
  type: "1098",
  fileName: "Meridian Home Lending Form 1098 2025.pdf",
  pageCount: 1,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -31),
  extractionStatus: "complete",
})
addDoc({
  id: nextDocId(),
  returnId: elleryReturn.id,
  type: "K-1",
  fileName: "Ellery Family Partnership Schedule K-1 2025.pdf",
  pageCount: 2,
  uploadedBy: marcus.id,
  uploadedAt: daysFrom(NOW, -18),
  extractionStatus: "pending",
})

// A couple more open items for Ellery's return, beyond the two scripted ones.
addOpenItem({
  id: nextItemId(),
  returnId: elleryReturn.id,
  title: "Confirm dependent's Social Security number",
  description:
    "The SSN on file for a claimed dependent doesn't match IRS records. Please confirm the correct number.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, 10),
  severity: "medium",
  linkedObjects: [],
  resolvedAt: null,
})
addOpenItem({
  id: nextItemId(),
  returnId: elleryReturn.id,
  title: "Provide prior-year return for carryover verification",
  description:
    "A capital loss carryover was indicated. Please provide last year's Schedule D to verify the carryover amount.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, -2),
  severity: "low",
  linkedObjects: [],
  resolvedAt: daysFrom(NOW, -1),
})
addOpenItem({
  id: nextItemId(),
  returnId: elleryReturn.id,
  title: "Sign engagement letter",
  description: "Please review and sign the engagement letter so we can begin preparing your return.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, -33),
  severity: "high",
  linkedObjects: [],
  resolvedAt: daysFrom(NOW, -32),
})

// ---------------------------------------------------------------------------
// Case 7 — Whitfield: e-filed, fully locked
// ---------------------------------------------------------------------------

const whitfieldFiledAt = "2025-03-28T00:00:00.000Z"
const whitfieldLockReason = "Filed with the IRS on March 28, 2025. Locked from further edits."

addDoc({
  id: nextDocId(),
  returnId: whitfieldReturn.id,
  type: "W-2",
  fileName: "Granite Peak Industries W-2 2024.pdf",
  pageCount: 1,
  uploadedBy: desmondWhitfield.id,
  uploadedAt: "2025-02-02T00:00:00.000Z",
  extractionStatus: "complete",
})
const whitfieldWagesExt = addExtracted({
  id: nextExtId(),
  documentId: documents[documents.length - 1].id,
  page: 1,
  bbox: { x: 0.62, y: 0.22, w: 0.3, h: 0.045 },
  label: "Box 1 — Wages, tips, other compensation",
  rawValue: "$112,900.00",
  confidence: 0.97,
})
addDoc({
  id: nextDocId(),
  returnId: whitfieldReturn.id,
  type: "1099-INT",
  fileName: "Union Trust Bank 1099-INT 2024.pdf",
  pageCount: 1,
  uploadedBy: desmondWhitfield.id,
  uploadedAt: "2025-02-05T00:00:00.000Z",
  extractionStatus: "complete",
})
const whitfieldInterestExt = addExtracted({
  id: nextExtId(),
  documentId: documents[documents.length - 1].id,
  page: 1,
  bbox: { x: 0.58, y: 0.34, w: 0.22, h: 0.04 },
  label: "Box 1 — Interest income",
  rawValue: "$318.40",
  confidence: 0.96,
})
for (let i = 0; i < 5; i++) {
  addDoc({
    id: nextDocId(),
    returnId: whitfieldReturn.id,
    type: faker.helpers.weightedArrayElement(DOC_TYPES),
    fileName: makeFileName(faker.helpers.weightedArrayElement(DOC_TYPES), 2024),
    pageCount: 1,
    uploadedBy: desmondWhitfield.id,
    uploadedAt: daysFrom(new Date("2025-02-10T00:00:00.000Z"), i),
    extractionStatus: "complete",
  })
}

const whitfieldFieldSpecs: { formLine: string; label: string; value: number | string; transform: TransformStep[]; sourceFieldIds: string[]; confidence: number; method: ProvenanceMethod }[] = [
  {
    formLine: "1040-1a",
    label: "Wages, salaries, tips, etc. (Form 1040, line 1a)",
    value: 112900,
    transform: [{ op: "direct", sourceId: whitfieldWagesExt.id }],
    sourceFieldIds: [whitfieldWagesExt.id],
    confidence: 0.97,
    method: "extracted",
  },
  {
    formLine: "Sch B-2",
    label: "Taxable interest (Schedule B, line 2)",
    value: 318.4,
    transform: [{ op: "direct", sourceId: whitfieldInterestExt.id }],
    sourceFieldIds: [whitfieldInterestExt.id],
    confidence: 0.96,
    method: "extracted",
  },
  {
    formLine: "1040-16",
    label: "Total tax (Form 1040, line 16)",
    value: 16840,
    transform: [{ op: "lookup", table: "2024-tax-tables", key: "S:100000-120000" }],
    sourceFieldIds: [],
    confidence: 0.92,
    method: "derived",
  },
  {
    formLine: "1040-34",
    label: "Overpayment / refund (Form 1040, line 34)",
    value: 1215,
    transform: [{ op: "manual-entry", enteredBy: staffUsers[2].id, reason: "Final refund figure confirmed against the e-file acknowledgment." }],
    sourceFieldIds: [],
    confidence: 1,
    method: "preparer-entered",
  },
]
for (const spec of whitfieldFieldSpecs) {
  const fieldId = nextFieldId()
  const provId = nextProvId()
  addField({
    id: fieldId,
    returnId: whitfieldReturn.id,
    formLine: spec.formLine,
    label: spec.label,
    value: spec.value,
    state: "locked",
    provenanceId: provId,
    lockReason: whitfieldLockReason,
    audit: [],
  })
  addProvenance({
    id: provId,
    targetFieldId: fieldId,
    sourceFieldIds: spec.sourceFieldIds,
    transform: spec.transform,
    confidence: spec.confidence,
    method: spec.method,
    verification: { by: staffUsers[2].id, at: whitfieldFiledAt },
  })
}
addOpenItem({
  id: nextItemId(),
  returnId: whitfieldReturn.id,
  title: "Sign engagement letter",
  description: "Please review and sign the engagement letter so we can begin preparing your return.",
  owner: "client",
  assignedTo: null,
  dueDate: "2025-01-20T00:00:00.000Z",
  severity: "high",
  linkedObjects: [],
  resolvedAt: "2025-01-18T00:00:00.000Z",
})
addOpenItem({
  id: nextItemId(),
  returnId: whitfieldReturn.id,
  title: "Verify direct deposit information",
  description: "Please confirm the bank routing and account number for any refund direct deposit.",
  owner: "client",
  assignedTo: null,
  dueDate: "2025-03-10T00:00:00.000Z",
  severity: "medium",
  linkedObjects: [],
  resolvedAt: "2025-03-09T00:00:00.000Z",
})

// ---------------------------------------------------------------------------
// Case 5 — Bloom: zero open items, otherwise a normal ready-to-sign return
// ---------------------------------------------------------------------------

for (let i = 0; i < 6; i++) {
  const doc = generateDocument(bloomReturn)
  void doc
}
const bloomExtracted = extractedByReturn.get(bloomReturn.id) ?? []
const bloomFieldSpecs = [
  { formLine: "1040-1a", label: "Wages, salaries, tips, etc. (Form 1040, line 1a)" },
  { formLine: "1040-16", label: "Total tax (Form 1040, line 16)" },
  { formLine: "1040-34", label: "Overpayment / refund (Form 1040, line 34)" },
]
bloomFieldSpecs.forEach((spec, i) => {
  const fieldId = nextFieldId()
  const provId = nextProvId()
  const source = bloomExtracted[i % Math.max(bloomExtracted.length, 1)]
  const transform: TransformStep[] = source
    ? [{ op: "direct", sourceId: source.id }]
    : [{ op: "manual-entry", enteredBy: renataBloom.id, reason: "Confirmed with the client directly." }]
  addField({
    id: fieldId,
    returnId: bloomReturn.id,
    formLine: spec.formLine,
    label: spec.label,
    value: source ? round2(faker.number.float({ min: 500, max: 90000, fractionDigits: 2 })) : 0,
    state: "verified",
    provenanceId: provId,
    audit: [],
  })
  addProvenance({
    id: provId,
    targetFieldId: fieldId,
    sourceFieldIds: source ? [source.id] : [],
    transform,
    confidence: source ? source.confidence : 1,
    method: source ? "extracted" : "client-entered",
    verification: { by: staffUsers[1].id, at: daysFrom(NOW, -4) },
  })
})
// Deliberately no open items on this return — the zero-open-items empty state.

// ---------------------------------------------------------------------------
// Case 9 — Voss: blocked but still "preparation"; case 3's sibling open item
// ---------------------------------------------------------------------------

for (let i = 0; i < 5; i++) {
  const doc = generateDocument(vossReturn)
  void doc
}
const vossExtracted = extractedByReturn.get(vossReturn.id) ?? []
if (vossExtracted.length > 0) {
  const fieldId = nextFieldId()
  const provId = nextProvId()
  const source = vossExtracted[0]
  addField({
    id: fieldId,
    returnId: vossReturn.id,
    formLine: "Sch C-31",
    label: "Net profit or loss from business (Schedule C, line 31)",
    value: round2(faker.number.float({ min: 12000, max: 68000, fractionDigits: 2 })),
    state: "needs-review",
    provenanceId: provId,
    audit: [],
  })
  addProvenance({
    id: provId,
    targetFieldId: fieldId,
    sourceFieldIds: [source.id],
    transform: [{ op: "direct", sourceId: source.id }],
    confidence: source.confidence,
    method: "extracted",
    verification: null,
  })
}
addOpenItem({
  id: DEMO_IDS.VOSS_BLOCKED_OPEN_ITEM,
  returnId: vossReturn.id,
  title: "Provide Schedule K-1 from Voss Consulting LLC",
  description:
    "Business income can't be finalized until the K-1 arrives. The client has been notified; following up weekly.",
  owner: "client",
  assignedTo: staffUsers[3].id,
  dueDate: daysFrom(NOW, 4),
  severity: "high",
  linkedObjects: [],
  resolvedAt: null,
})

// ---------------------------------------------------------------------------
// Case 10 — Nadia's own personal return
// ---------------------------------------------------------------------------

for (let i = 0; i < 4; i++) {
  const doc = generateDocument(nadiaPersonalReturn)
  void doc
}
const nadiaExtracted = extractedByReturn.get(nadiaPersonalReturn.id) ?? []
;[
  { formLine: "1040-1a", label: "Wages, salaries, tips, etc. (Form 1040, line 1a)", state: "verified" as FieldState },
  { formLine: "Sch B-2", label: "Taxable interest (Schedule B, line 2)", state: "ai-suggested" as FieldState },
].forEach((spec, i) => {
  const source = nadiaExtracted[i % Math.max(nadiaExtracted.length, 1)]
  if (!source) return
  const fieldId = nextFieldId()
  const provId = nextProvId()
  addField({
    id: fieldId,
    returnId: nadiaPersonalReturn.id,
    formLine: spec.formLine,
    label: spec.label,
    value: round2(faker.number.float({ min: 500, max: 140000, fractionDigits: 2 })),
    state: spec.state,
    provenanceId: provId,
    audit: [],
  })
  addProvenance({
    id: provId,
    targetFieldId: fieldId,
    sourceFieldIds: [source.id],
    transform: [{ op: "direct", sourceId: source.id }],
    confidence: source.confidence,
    method: "extracted",
    verification: spec.state === "verified" ? { by: colleaguePreparer.id, at: daysFrom(NOW, -6) } : null,
  })
})
addOpenItem({
  id: nextItemId(),
  returnId: nadiaPersonalReturn.id,
  title: "Confirm health savings account contributions",
  description: "Please confirm total HSA contributions made directly (outside of payroll) during the year.",
  owner: "client",
  assignedTo: null,
  dueDate: daysFrom(NOW, 12),
  severity: "low",
  linkedObjects: [],
  resolvedAt: null,
})

// ---------------------------------------------------------------------------
// Generic documents — allocated to hit exactly 420 total
// ---------------------------------------------------------------------------

const documentsSoFar = documents.length
const GENERIC_DOCUMENT_TOTAL = 420 - documentsSoFar
const docsPerGeneric = allocateExact(GENERIC_DOCUMENT_TOTAL, genericReturns.length, 2, 14)
genericReturns.forEach((ret, i) => {
  for (let j = 0; j < docsPerGeneric[i]; j++) {
    generateDocument(ret)
  }
})

// ---------------------------------------------------------------------------
// Generic return fields + provenance — allocated to hit exactly 80 total
// ---------------------------------------------------------------------------

const GENERIC_FIELD_TEMPLATES: { formLine: string; label: string; range: [number, number] }[] = [
  { formLine: "1040-1a", label: "Wages, salaries, tips, etc. (Form 1040, line 1a)", range: [18000, 210000] },
  { formLine: "Sch B-2", label: "Taxable interest (Schedule B, line 2)", range: [5, 3200] },
  { formLine: "1040-3b", label: "Ordinary dividends (Form 1040, line 3b)", range: [0, 6500] },
  { formLine: "Sch D-16", label: "Net capital gain or loss (Schedule D, line 16)", range: [-5000, 20000] },
  { formLine: "Sch C-31", label: "Net profit or loss from business (Schedule C, line 31)", range: [-10000, 80000] },
  { formLine: "1040-11", label: "Adjusted gross income (Form 1040, line 11)", range: [20000, 240000] },
  { formLine: "1040-15", label: "Taxable income (Form 1040, line 15)", range: [15000, 220000] },
  { formLine: "1040-16", label: "Total tax (Form 1040, line 16)", range: [1000, 48000] },
  { formLine: "1040-25", label: "Federal income tax withheld (Form 1040, line 25)", range: [800, 40000] },
  { formLine: "1040-34", label: "Overpayment / refund (Form 1040, line 34)", range: [50, 6000] },
]

const fieldsSoFar = fields.length
const GENERIC_FIELD_TOTAL = 80 - fieldsSoFar
const fieldsPerGeneric = allocateExact(GENERIC_FIELD_TOTAL, genericReturns.length, 0, 3)

let auditsAdded = 0
const AUDIT_TARGET = 7

genericReturns.forEach((ret, i) => {
  const returnLocked = ret.staffState === "e-filed"
  const available = extractedByReturn.get(ret.id) ?? []
  for (let j = 0; j < fieldsPerGeneric[i]; j++) {
    const template = pick(GENERIC_FIELD_TEMPLATES)
    const useSum = available.length >= 2 && faker.datatype.boolean(0.2)
    const useDirect = !useSum && available.length >= 1

    let transform: TransformStep[]
    let sourceFieldIds: string[]
    let method: ProvenanceMethod
    let confidence: number

    if (useSum) {
      const sources = faker.helpers.arrayElements(available, { min: 2, max: Math.min(3, available.length) })
      sourceFieldIds = sources.map((s) => s.id)
      transform = [{ op: "sum", sourceIds: sourceFieldIds }]
      method = "derived"
      confidence = Math.min(...sources.map((s) => s.confidence))
    } else if (useDirect) {
      const source = pick(available)
      sourceFieldIds = [source.id]
      transform = [{ op: "direct", sourceId: source.id }]
      method = "extracted"
      confidence = source.confidence
    } else {
      sourceFieldIds = []
      const enteredBy = faker.datatype.boolean(0.5) ? ret.clientId : (ret.assignedTo ?? pick(allStaff).id)
      transform = [{ op: "manual-entry", enteredBy, reason: "Confirmed directly with the client." }]
      method = enteredBy === ret.clientId ? "client-entered" : "preparer-entered"
      confidence = 1
    }

    const value = round2(faker.number.float({ min: template.range[0], max: template.range[1], fractionDigits: 2 }))

    let state: FieldState
    if (returnLocked) {
      state = "locked"
    } else if (method === "extracted" || method === "derived") {
      state =
        confidence < 0.8
          ? faker.helpers.weightedArrayElement([
              { weight: 1, value: "ai-suggested" as FieldState },
              { weight: 1, value: "needs-review" as FieldState },
            ])
          : faker.helpers.weightedArrayElement([
              { weight: 3, value: "ai-suggested" as FieldState },
              { weight: 4, value: "verified" as FieldState },
              { weight: 1, value: "needs-review" as FieldState },
            ])
    } else {
      state = faker.helpers.weightedArrayElement([
        { weight: 3, value: "editable" as FieldState },
        { weight: 2, value: "verified" as FieldState },
      ])
    }

    const fieldId = nextFieldId()
    const provId = nextProvId()
    const audit: AuditEntry[] = []

    if (
      state === "verified" &&
      (method === "extracted" || method === "derived") &&
      auditsAdded < AUDIT_TARGET &&
      faker.datatype.boolean(0.35)
    ) {
      const correctedFrom = round2(value * faker.number.float({ min: 0.9, max: 1.1, fractionDigits: 3 }))
      audit.push({
        id: nextAuditId(),
        fieldId,
        at: daysFrom(NOW, -faker.number.int({ min: 2, max: 40 })),
        by: ret.assignedTo ?? pick(allStaff).id,
        previousValue: correctedFrom,
        newValue: value,
        previousState: "ai-suggested",
        newState: "verified",
      })
      auditsAdded++
    }

    addField({
      id: fieldId,
      returnId: ret.id,
      formLine: template.formLine,
      label: template.label,
      value,
      state,
      provenanceId: provId,
      lockReason: returnLocked ? "Filed and locked from further edits." : undefined,
      audit,
    })
    addProvenance({
      id: provId,
      targetFieldId: fieldId,
      sourceFieldIds,
      transform,
      confidence,
      method,
      verification:
        state === "verified" || state === "locked"
          ? { by: ret.assignedTo ?? pick(allStaff).id, at: daysFrom(NOW, -faker.number.int({ min: 1, max: 20 })) }
          : null,
    })
  }
})

// ---------------------------------------------------------------------------
// Open items — allocated to hit exactly 120 total. Bloom stays at 0 (excluded below).
// Ellery2026 isn't in genericReturns so it gets none from this pool either — its two are
// hand-authored above, and openItemsSoFar already counts them, so the 120 total still holds.
// ---------------------------------------------------------------------------

const OPEN_ITEM_TEMPLATES: { title: string; description: string }[] = [
  { title: "Upload missing W-2", description: "We're missing a W-2 that shows up as a possible additional employer on last year's return. Please upload it or confirm you no longer worked there." },
  { title: "Confirm dependent's Social Security number", description: "The SSN on file for a claimed dependent doesn't match IRS records. Please confirm the correct number." },
  { title: "Clarify home office square footage", description: "To calculate the home office deduction we need the square footage used exclusively for business, and the total square footage of the home." },
  { title: "Provide childcare provider's EIN", description: "The Child and Dependent Care Credit requires the care provider's EIN or SSN. Please provide it." },
  { title: "Confirm estimated tax payments", description: "Please confirm the dates and amounts of any estimated tax payments made during the year." },
  { title: "Upload Form 1095-A", description: "Marketplace health insurance was indicated on the questionnaire. Please upload Form 1095-A to reconcile the premium tax credit." },
  { title: "Verify direct deposit information", description: "Please confirm the bank routing and account number for any refund direct deposit." },
  { title: "Provide charitable contribution receipts", description: "Any single charitable contribution over $250 requires a written acknowledgment from the organization. Please provide receipts." },
  { title: "Clarify business mileage log", description: "Vehicle expenses were claimed as a business deduction. Please provide a mileage log or total business miles driven." },
  { title: "Provide prior-year return for carryover verification", description: "A capital loss carryover was indicated. Please provide last year's Schedule D to verify the carryover amount." },
  { title: "Confirm health savings account contributions", description: "Please confirm total HSA contributions made directly (outside of payroll) during the year." },
  { title: "Sign engagement letter", description: "Please review and sign the engagement letter so we can begin preparing your return." },
]

const openItemEligibleReturns = genericReturns.filter((r) => r.id !== bloomReturn.id)
const openItemsSoFar = openItems.length
const GENERIC_OPEN_ITEM_TOTAL = 120 - openItemsSoFar
const itemsPerGeneric = allocateExact(GENERIC_OPEN_ITEM_TOTAL, openItemEligibleReturns.length, 0, 5)

openItemEligibleReturns.forEach((ret, i) => {
  const returnDocs = documents.filter((d) => d.returnId === ret.id)
  for (let j = 0; j < itemsPerGeneric[i]; j++) {
    const template = pick(OPEN_ITEM_TEMPLATES)
    const owner = faker.helpers.weightedArrayElement([
      { weight: 3, value: "client" as const },
      { weight: 2, value: "firm" as const },
    ])
    const resolved = faker.datatype.boolean(0.4)
    const linkedObjects: ObjectRef[] =
      returnDocs.length > 0 && faker.datatype.boolean(0.4)
        ? [{ type: "document", id: pick(returnDocs).id }]
        : []
    addOpenItem({
      id: nextItemId(),
      returnId: ret.id,
      title: template.title,
      description: template.description,
      owner,
      assignedTo: owner === "firm" ? (ret.assignedTo ?? pick(allStaff).id) : null,
      dueDate: daysFrom(NOW, faker.number.int({ min: -20, max: 30 })),
      severity: faker.helpers.weightedArrayElement([
        { weight: 4, value: "low" as Severity },
        { weight: 4, value: "medium" as Severity },
        { weight: 2, value: "high" as Severity },
      ]),
      linkedObjects,
      resolvedAt: resolved ? daysFrom(NOW, -faker.number.int({ min: 1, max: 25 })) : null,
    })
  }
})

// ---------------------------------------------------------------------------
// Threads + messages — 12 total, 5 scripted, 7 generic
// ---------------------------------------------------------------------------

function makeThread(
  id: string,
  scope: ObjectRef,
  visibility: "internal" | "client-visible",
  participants: UserRef[],
  messageSpecs: { authorId: UserRef; body: string; isRequest: boolean; daysAgo: number }[],
  resolved: boolean
): Thread {
  const messages: Message[] = messageSpecs.map((m) =>
    ({
      id: nextMsgId(),
      threadId: id,
      authorId: m.authorId,
      body: m.body,
      sentAt: daysFrom(NOW, -m.daysAgo),
      isRequest: m.isRequest,
    })
  )
  return addThread({
    id,
    scope,
    visibility,
    participants,
    messages,
    resolvedAt: resolved ? daysFrom(NOW, -Math.max(1, messageSpecs[messageSpecs.length - 1]?.daysAgo ?? 1) + 1) : null,
  })
}

makeThread(
  nextThreadId(),
  { type: "field", id: DEMO_IDS.ELLERY_INTEREST_FIELD },
  "internal",
  [nadia.id, staffUsers[4].id],
  [
    { authorId: nadia.id, body: "The AI read First Capital's 1099-INT as $842.10 but the actual box 1 is $824.10 — digits got transposed. Fixed and verified.", isRequest: false, daysAgo: 26 },
    { authorId: staffUsers[4].id, body: "Good catch. Worth flagging that this was 86% confidence — not exactly a low-confidence miss.", isRequest: false, daysAgo: 26 },
  ],
  true
)
makeThread(
  nextThreadId(),
  { type: "item", id: DEMO_IDS.ELLERY_CONFLICTING_1099_OPEN_ITEM },
  "client-visible",
  [nadia.id, marcus.id],
  [
    { authorId: nadia.id, body: "We received two 1099-INT forms from Regional Community Bank with different amounts ($412.50 and $458.90). Do you know if one is a corrected reissue?", isRequest: true, daysAgo: 11 },
  ],
  false
)
makeThread(
  nextThreadId(),
  { type: "return", id: vossReturn.id },
  "internal",
  [staffUsers[3].id, nadia.id],
  [
    { authorId: staffUsers[3].id, body: "Still waiting on the K-1 from Voss Consulting LLC — this return can't move past preparation without it.", isRequest: false, daysAgo: 8 },
    { authorId: nadia.id, body: "Flagged. Let me know if you want me to send a follow-up to the client.", isRequest: false, daysAgo: 7 },
  ],
  false
)
makeThread(
  nextThreadId(),
  { type: "return", id: whitfieldReturn.id },
  "client-visible",
  [staffUsers[2].id, desmondWhitfield.id],
  [
    { authorId: staffUsers[2].id, body: "Your return was accepted by the IRS today. You should see your refund within 2-3 weeks.", isRequest: false, daysAgo: 495 },
  ],
  true
)
makeThread(
  nextThreadId(),
  { type: "return", id: bloomReturn.id },
  "client-visible",
  [staffUsers[1].id, renataBloom.id],
  [
    { authorId: staffUsers[1].id, body: "Your return is ready to sign — everything's been reviewed. Let us know if you have any questions before signing.", isRequest: false, daysAgo: 4 },
    { authorId: renataBloom.id, body: "Looks good, signing now. Thanks!", isRequest: false, daysAgo: 3 },
  ],
  true
)

const threadableReturns = faker.helpers.arrayElements(genericReturns, 7)
threadableReturns.forEach((ret) => {
  const visibility = faker.datatype.boolean(0.5) ? "internal" : "client-visible"
  const staffer = ret.assignedTo ?? pick(allStaff).id
  const participants = visibility === "internal" ? [staffer, pick(allStaff).id] : [staffer, ret.clientId]
  const messageCount = faker.number.int({ min: 1, max: 3 })
  const messageSpecs = Array.from({ length: messageCount }, (_, i) => ({
    authorId: pick(participants),
    body: faker.lorem.sentences({ min: 1, max: 2 }),
    isRequest: i === 0 && faker.datatype.boolean(0.4),
    daysAgo: (messageCount - i) * faker.number.int({ min: 1, max: 4 }),
  }))
  makeThread(
    nextThreadId(),
    { type: "return", id: ret.id },
    visibility,
    participants,
    messageSpecs,
    faker.datatype.boolean(0.3)
  )
})

// ---------------------------------------------------------------------------
// Questionnaire items — 40 total, spread across active returns
// ---------------------------------------------------------------------------

const QUESTIONNAIRE_TEMPLATES: { sectionId: string; question: string; answerType: AnswerType }[] = [
  { sectionId: "household", question: "How many dependents will you claim this year?", answerType: "number" },
  { sectionId: "household", question: "Did your marital status change during the tax year?", answerType: "boolean" },
  { sectionId: "income", question: "Did you receive any income from cryptocurrency transactions?", answerType: "boolean" },
  { sectionId: "income", question: "Did you work in more than one state this year?", answerType: "boolean" },
  { sectionId: "deductions", question: "Do you want to itemize deductions or take the standard deduction?", answerType: "choice" },
  { sectionId: "deductions", question: "What was your total mortgage interest paid?", answerType: "number" },
  { sectionId: "credits", question: "Did you pay for childcare while you worked?", answerType: "boolean" },
  { sectionId: "credits", question: "Did you make any energy-efficient home improvements?", answerType: "boolean" },
  { sectionId: "business", question: "What percentage of your home is used exclusively for business?", answerType: "number" },
  { sectionId: "general", question: "Is there anything else we should know before preparing your return?", answerType: "text" },
]

const questionnaireEligibleReturns = [elleryReturn, vossReturn, nadiaPersonalReturn, ...genericReturns].filter(
  (r) => r.clientPhase === "reviewing" || r.clientPhase === "needs-your-answer" || r.clientPhase === "gathering-documents"
)
const qReturns = faker.helpers.arrayElements(
  questionnaireEligibleReturns,
  Math.min(16, questionnaireEligibleReturns.length)
)
const qPerReturn = allocateExact(40, qReturns.length, 1, 4)

function sampleAnswer(type: AnswerType): string | number | boolean | null {
  if (faker.datatype.boolean(0.2)) return null // unanswered — feeds "needs-your-answer"
  switch (type) {
    case "text":
      return faker.lorem.sentence()
    case "number":
      return faker.number.int({ min: 0, max: 100 })
    case "boolean":
      return faker.datatype.boolean()
    case "choice":
      return pick(["Standard deduction", "Itemize"])
  }
}

qReturns.forEach((ret, i) => {
  for (let j = 0; j < qPerReturn[i]; j++) {
    const template = pick(QUESTIONNAIRE_TEMPLATES)
    addQuestionnaireItem({
      id: nextQId(),
      returnId: ret.id,
      sectionId: template.sectionId,
      question: template.question,
      answerType: template.answerType,
      answer: sampleAnswer(template.answerType),
      required: faker.datatype.boolean(0.7),
    })
  }
})

// ---------------------------------------------------------------------------
// Validation — throws if any reference dangles
// ---------------------------------------------------------------------------

function validate() {
  const errors: string[] = []
  const userIds = new Set(users.map((u) => u.id))
  const returnIds = new Set(returns.map((r) => r.id))
  const documentIds = new Set(documents.map((d) => d.id))
  const extractedIds = new Set(extractedFields.map((e) => e.id))
  const fieldIds = new Set(fields.map((f) => f.id))
  const provenanceIds = new Set(provenance.map((p) => p.id))
  const openItemIds = new Set(openItems.map((i) => i.id))
  const threadIds = new Set(threads.map((t) => t.id))
  const questionnaireIds = new Set(questionnaireItems.map((q) => q.id))

  function need(ok: boolean, message: string) {
    if (!ok) errors.push(message)
  }
  function resolveRef(ref: ObjectRef): boolean {
    switch (ref.type) {
      case "field":
        return fieldIds.has(ref.id)
      case "document":
        return documentIds.has(ref.id)
      case "return":
        return returnIds.has(ref.id)
      case "item":
        return openItemIds.has(ref.id)
      case "thread":
        return threadIds.has(ref.id)
    }
  }

  for (const u of users) {
    need(u.id.length > 0, `User with empty id`)
  }

  for (const r of returns) {
    need(userIds.has(r.clientId), `Return ${r.id}: clientId ${r.clientId} does not resolve to a user`)
    need(r.assignedTo === null || userIds.has(r.assignedTo), `Return ${r.id}: assignedTo ${r.assignedTo} does not resolve to a user`)
  }

  for (const d of documents) {
    need(returnIds.has(d.returnId), `Document ${d.id}: returnId ${d.returnId} does not resolve to a return`)
    need(userIds.has(d.uploadedBy), `Document ${d.id}: uploadedBy ${d.uploadedBy} does not resolve to a user`)
  }

  for (const e of extractedFields) {
    need(documentIds.has(e.documentId), `ExtractedField ${e.id}: documentId ${e.documentId} does not resolve to a document`)
  }

  for (const f of fields) {
    need(returnIds.has(f.returnId), `ReturnField ${f.id}: returnId ${f.returnId} does not resolve to a return`)
    need(f.provenanceId === null || provenanceIds.has(f.provenanceId), `ReturnField ${f.id}: provenanceId ${f.provenanceId} does not resolve to a provenance record`)
    for (const a of f.audit) {
      need(a.fieldId === f.id, `AuditEntry ${a.id}: fieldId ${a.fieldId} does not match owning field ${f.id}`)
      need(userIds.has(a.by), `AuditEntry ${a.id}: by ${a.by} does not resolve to a user`)
    }
  }

  for (const p of provenance) {
    need(fieldIds.has(p.targetFieldId), `Provenance ${p.id}: targetFieldId ${p.targetFieldId} does not resolve to a field`)
    for (const sid of p.sourceFieldIds) {
      need(extractedIds.has(sid), `Provenance ${p.id}: sourceFieldId ${sid} does not resolve to an ExtractedField`)
    }
    for (const step of p.transform) {
      if (step.op === "direct" || step.op === "multiply") {
        need(extractedIds.has(step.sourceId), `Provenance ${p.id}: transform ${step.op} sourceId ${step.sourceId} does not resolve to an ExtractedField`)
      } else if (step.op === "sum" || step.op === "subtract") {
        for (const sid of step.sourceIds) {
          need(extractedIds.has(sid), `Provenance ${p.id}: transform ${step.op} sourceId ${sid} does not resolve to an ExtractedField`)
        }
      } else if (step.op === "manual-entry") {
        need(userIds.has(step.enteredBy), `Provenance ${p.id}: transform manual-entry enteredBy ${step.enteredBy} does not resolve to a user`)
      }
    }
    if (p.verification) {
      need(userIds.has(p.verification.by), `Provenance ${p.id}: verification.by ${p.verification.by} does not resolve to a user`)
    }
  }

  for (const i of openItems) {
    need(returnIds.has(i.returnId), `OpenItem ${i.id}: returnId ${i.returnId} does not resolve to a return`)
    need(i.assignedTo === null || userIds.has(i.assignedTo), `OpenItem ${i.id}: assignedTo ${i.assignedTo} does not resolve to a user`)
    for (const ref of i.linkedObjects) {
      need(resolveRef(ref), `OpenItem ${i.id}: linkedObject ${ref.type}:${ref.id} does not resolve`)
    }
  }

  for (const t of threads) {
    need(resolveRef(t.scope), `Thread ${t.id}: scope ${t.scope.type}:${t.scope.id} does not resolve`)
    for (const p of t.participants) {
      need(userIds.has(p), `Thread ${t.id}: participant ${p} does not resolve to a user`)
    }
    for (const m of t.messages) {
      need(m.threadId === t.id, `Message ${m.id}: threadId ${m.threadId} does not match owning thread ${t.id}`)
      need(userIds.has(m.authorId), `Message ${m.id}: authorId ${m.authorId} does not resolve to a user`)
    }
  }

  for (const q of questionnaireItems) {
    need(returnIds.has(q.returnId), `QuestionnaireItem ${q.id}: returnId ${q.returnId} does not resolve to a return`)
    need(!q.linkedDocumentId || documentIds.has(q.linkedDocumentId), `QuestionnaireItem ${q.id}: linkedDocumentId ${q.linkedDocumentId} does not resolve to a document`)
  }

  for (const key of Object.keys(DEMO_IDS) as (keyof typeof DEMO_IDS)[]) {
    const id = DEMO_IDS[key]
    const resolves =
      userIds.has(id) ||
      returnIds.has(id) ||
      documentIds.has(id) ||
      extractedIds.has(id) ||
      fieldIds.has(id) ||
      provenanceIds.has(id) ||
      openItemIds.has(id) ||
      questionnaireIds.has(id) ||
      id === DEMO_IDS.VOSS_BLOCKER // blockers are nested, not a top-level collection — checked separately below
    need(resolves, `DEMO_IDS.${key} (${id}) does not resolve to any generated record`)
  }
  need(
    vossReturn.blockers.some((b) => b.id === DEMO_IDS.VOSS_BLOCKER),
    `DEMO_IDS.VOSS_BLOCKER (${DEMO_IDS.VOSS_BLOCKER}) is not present on the Voss return's blockers`
  )

  if (errors.length > 0) {
    throw new Error(`Dataset validation failed with ${errors.length} dangling reference(s):\n` + errors.join("\n"))
  }
}

validate()

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

function write(fileName: string, data: unknown) {
  writeFileSync(join(import.meta.dirname, fileName), JSON.stringify(data, null, 2) + "\n", "utf-8")
}

write("users.json", users)
write("returns.json", returns)
write("documents.json", documents)
write("extractedFields.json", extractedFields)
write("fields.json", fields)
write("provenance.json", provenance)
write("openItems.json", openItems)
write("threads.json", threads)
write("questionnaireItems.json", questionnaireItems)

console.log("Seed complete.")
console.log(`  users:               ${users.length}`)
console.log(`  returns:             ${returns.length}`)
console.log(`  documents:           ${documents.length}`)
console.log(`  extractedFields:     ${extractedFields.length}`)
console.log(`  fields (provenance): ${fields.length}`)
console.log(`  provenance:          ${provenance.length}`)
console.log(`  openItems:           ${openItems.length}`)
console.log(`  threads:             ${threads.length}`)
console.log(`  questionnaireItems:  ${questionnaireItems.length}`)
const lowConfidenceCount = [...extractedFields.map((e) => e.confidence), ...provenance.map((p) => p.confidence)].filter((c) => c < 0.8).length
const totalConfidenceValues = extractedFields.length + provenance.length
console.log(
  `  confidence < 0.80:   ${lowConfidenceCount}/${totalConfidenceValues} (${round2((lowConfidenceCount / totalConfidenceValues) * 100)}%)`
)
