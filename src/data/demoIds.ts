/**
 * Stable, memorable ids for the demo dataset's named entities and seeded edge cases.
 * generate.ts constructs these exact records; fixtures.ts re-exports this constant so
 * later phases and the video script can jump straight to them instead of hunting
 * through generated JSON.
 */
export const DEMO_IDS = {
  // Named entities
  /** Client. Owns both ELLERY_RETURN (centerpiece) and ELLERY_RETURN_FIRST_RUN (case 6). */
  MARCUS_ELLERY_USER: "user-marcus-ellery",
  /** Preparer. Owns ELLERY_RETURN in her firm queue; also has her own personal return (case 10). */
  NADIA_OSEI_USER: "user-nadia-osei",

  // Case 1 — a field derived by summing three W-2 sources (the video centerpiece)
  ELLERY_RETURN: "return-ellery-2025",
  ELLERY_WAGES_FIELD: "field-ellery-1040-1a-wages",
  ELLERY_WAGES_PROVENANCE: "prov-ellery-1040-1a-wages",
  ELLERY_W2_ACME_DOC: "doc-ellery-w2-acme",
  ELLERY_W2_BELMONT_DOC: "doc-ellery-w2-belmont",
  ELLERY_W2_CORVID_DOC: "doc-ellery-w2-corvid",
  ELLERY_W2_ACME_EXTRACTED: "ext-ellery-w2-acme-box1",
  ELLERY_W2_BELMONT_EXTRACTED: "ext-ellery-w2-belmont-box1",
  /** The flagged source — confidence 0.71, drags the summed field's confidence down with it. */
  ELLERY_W2_CORVID_EXTRACTED: "ext-ellery-w2-corvid-box1",

  // Case 2 — AI got it wrong; a preparer corrected it; audit trail intact
  ELLERY_INTEREST_FIELD: "field-ellery-sch-b-interest",
  ELLERY_INTEREST_PROVENANCE: "prov-ellery-sch-b-interest",
  ELLERY_INTEREST_DOC: "doc-ellery-1099int-firstcap",
  ELLERY_INTEREST_EXTRACTED: "ext-ellery-1099int-firstcap-box1",

  // Case 3 — two 1099s from the same payer, conflicting amounts
  ELLERY_1099INT_REGIONAL_A_DOC: "doc-ellery-1099int-regional-a",
  ELLERY_1099INT_REGIONAL_B_DOC: "doc-ellery-1099int-regional-b",
  ELLERY_1099INT_REGIONAL_A_EXTRACTED: "ext-ellery-1099int-regional-a-box1",
  ELLERY_1099INT_REGIONAL_B_EXTRACTED: "ext-ellery-1099int-regional-b-box1",
  ELLERY_CONFLICTING_1099_OPEN_ITEM: "item-ellery-conflicting-1099int",

  // Case 4 — a document where extraction failed entirely
  ELLERY_FAILED_EXTRACTION_DOC: "doc-ellery-1099b-failed",
  ELLERY_FAILED_EXTRACTION_OPEN_ITEM: "item-ellery-failed-extraction",

  // Case 5 — a return with zero open items (empty state)
  BLOOM_RETURN: "return-bloom-2025",

  // Case 6 — a brand-new client with no documents (first-run state). These three are
  // client-owned but only surface once the first document exists — ClientHome's
  // onboarding-stage derivation keys off document count, so State A shows none of this;
  // uploading the first document (ClientHome's fake-upload flow) moves the return into
  // State B with these as the queue, not straight to State C.
  ELLERY_RETURN_FIRST_RUN: "return-ellery-2026",
  ELLERY_FIRST_RUN_W2_QUESTION: "qi-ellery-2026-w2-employer",
  ELLERY_FIRST_RUN_SECOND_DOC_ITEM: "item-ellery-2026-second-doc",
  ELLERY_FIRST_RUN_ADDRESS_ITEM: "item-ellery-2026-address",

  // Case 7 — an e-filed, fully locked return (read-only affordance)
  WHITFIELD_RETURN: "return-whitfield-2024",

  // Case 8 — a field at confidence 0.44 that should be visibly alarming
  ELLERY_ALARMING_FIELD: "field-ellery-8949-cost-basis",
  ELLERY_ALARMING_PROVENANCE: "prov-ellery-8949-cost-basis",
  ELLERY_ALARMING_DOC: "doc-ellery-1099b-handwritten",
  ELLERY_ALARMING_EXTRACTED: "ext-ellery-1099b-handwritten-basis",

  // Case 9 — a return blocked but still in Preparation (blocking is not a status)
  VOSS_RETURN: "return-voss-2025",
  VOSS_BLOCKER: "blocker-voss-missing-k1",
  VOSS_BLOCKED_OPEN_ITEM: "item-voss-missing-k1",

  // Case 10 — Nadia Osei's own personal return (dual role: preparer and client)
  NADIA_OSEI_PERSONAL_RETURN: "return-osei-2025",
} as const

export type DemoId = (typeof DEMO_IDS)[keyof typeof DEMO_IDS]
