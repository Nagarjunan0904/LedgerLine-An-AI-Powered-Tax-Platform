import type { UserRef } from './user'

export type DocumentType =
  | 'W-2'
  | '1099-INT'
  | '1099-DIV'
  | '1099-B'
  | 'K-1'
  | '1098'
  | 'receipt'
  | 'other'

export type ExtractionStatus = 'pending' | 'complete' | 'partial' | 'failed'

export interface Document {
  id: string
  returnId: string
  type: DocumentType
  fileName: string
  pageCount: number
  uploadedBy: UserRef
  /** ISO 8601 timestamp */
  uploadedAt: string
  extractionStatus: ExtractionStatus
}

/** Bounding box normalized 0–1 relative to the page. */
export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface ExtractedField {
  id: string
  documentId: string
  page: number
  bbox: BBox
  label: string
  rawValue: string
  /** 0–1 */
  confidence: number
}
