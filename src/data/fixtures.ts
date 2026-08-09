/**
 * The only supported way to read demo data. Pages import from here — never the raw JSON
 * files in this directory, and never src/data/generate.ts (that's a build-time script).
 */
import type {
  User,
  Return,
  Role,
  Document,
  ExtractedField,
  ReturnField,
  Provenance,
  OpenItem,
  Thread,
  ObjectRef,
  QuestionnaireItem,
} from "@/types"

import usersJson from "./users.json"
import returnsJson from "./returns.json"
import documentsJson from "./documents.json"
import extractedFieldsJson from "./extractedFields.json"
import fieldsJson from "./fields.json"
import provenanceJson from "./provenance.json"
import openItemsJson from "./openItems.json"
import threadsJson from "./threads.json"
import questionnaireItemsJson from "./questionnaireItems.json"

export { DEMO_IDS } from "./demoIds"

// JSON imports lose type information at the module boundary. The cast is safe because
// generate.ts type-checks every object against these same interfaces at construction time —
// this file trusts that, rather than re-validating at runtime.
const users = usersJson as User[]
const allReturns = returnsJson as Return[]
const documents = documentsJson as Document[]
const extractedFields = extractedFieldsJson as ExtractedField[]
const fields = fieldsJson as ReturnField[]
const provenanceRecords = provenanceJson as Provenance[]
const openItems = openItemsJson as OpenItem[]
const threads = threadsJson as Thread[]
const questionnaireItems = questionnaireItemsJson as QuestionnaireItem[]

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id)
}

export function getReturn(id: string): Return | undefined {
  return allReturns.find((r) => r.id === id)
}

export function getReturns(): Return[] {
  return allReturns
}

/**
 * Role isn't tracked per-user in the type contract (User only carries `kind`), so the caller
 * supplies it — typically from whatever's driving the current session's view. Client-facing
 * roles see their own returns; firm-admin/reviewer see everything the firm owns; everyone
 * else (preparer, seasonal) sees their own queue.
 */
export function getReturnsForUser(userId: string, role: Role): Return[] {
  if (role === "individual" || role === "business-owner") {
    return allReturns.filter((r) => r.clientId === userId)
  }
  if (role === "firm-admin" || role === "reviewer") {
    return allReturns.filter((r) => r.assignedTo === userId || r.ownerRole === "firm")
  }
  return allReturns.filter((r) => r.assignedTo === userId)
}

export function getDocumentsForReturn(returnId: string): Document[] {
  return documents.filter((d) => d.returnId === returnId)
}

/** Every document across every return — the firm-wide pool DocumentExplorer searches in "All
 * documents" scope. Unfiltered by design, matching getOpenItems(): a document has no
 * visibility concept of its own (unlike Thread), so the access boundary that matters is which
 * return a viewer may see, not which documents — callers scope that themselves (a client role
 * must always go through getDocumentsForReturn on their own return, never this). */
export function getDocuments(): Document[] {
  return documents
}

export function getDocument(id: string): Document | undefined {
  return documents.find((d) => d.id === id)
}

export function getFieldsForReturn(returnId: string): ReturnField[] {
  return fields.filter((f) => f.returnId === returnId)
}

export function getField(id: string): ReturnField | undefined {
  return fields.find((f) => f.id === id)
}

/** Looks up a field's Provenance by the field's id (not the provenance record's own id). */
export function getProvenance(fieldId: string): Provenance | undefined {
  return provenanceRecords.find((p) => p.targetFieldId === fieldId)
}

export function getExtractedField(id: string): ExtractedField | undefined {
  return extractedFields.find((e) => e.id === id)
}

export function getExtractedFieldsForDocument(documentId: string): ExtractedField[] {
  return extractedFields.filter((e) => e.documentId === documentId)
}

export function getOpenItemsForReturn(returnId: string): OpenItem[] {
  return openItems.filter((i) => i.returnId === returnId)
}

export function getOpenItems(): OpenItem[] {
  return openItems
}

/**
 * role is mandatory, not optional — the client role must never be able to fetch an internal
 * thread by forgetting to filter downstream. individual/business-owner only ever get back
 * client-visible threads; every other role sees everything scoped here.
 */
export function getThreadsForObject(ref: ObjectRef, role: Role): Thread[] {
  const inScope = threads.filter((t) => t.scope.type === ref.type && t.scope.id === ref.id)
  if (role === "individual" || role === "business-owner") {
    return inScope.filter((t) => t.visibility === "client-visible")
  }
  return inScope
}

export function getThread(id: string): Thread | undefined {
  return threads.find((t) => t.id === id)
}

export function getQuestionnaireItemsForReturn(returnId: string): QuestionnaireItem[] {
  return questionnaireItems.filter((q) => q.returnId === returnId)
}
