import { create } from "zustand"

import type { Document, DocumentType } from "@/types"

let uploadSequence = 0

interface DocumentUploadsState {
  /** Documents added through the fake-upload flow, layered on top of the read-only fixture
   * set — never written back into it. In-memory only; resets on reload, same as every other
   * mutation in this prototype (see CLAUDE.md). Keyed by returnId. */
  uploadedByReturn: Record<string, Document[]>
  /** The returnId currently mid-upload, if any — drives the 800ms "processing" affordance.
   * A single field rather than a set because the UI only ever has one upload in flight. */
  processingReturnId: string | null
  /** Simulates picking a file and having it processed: flips to "processing" immediately,
   * then after 800ms appends a real Document record so getDocumentsForReturn-shaped code
   * downstream (ClientHome's stage/task derivation) picks it up the same way it would a
   * fixture document. */
  upload: (returnId: string, type: DocumentType, fileName: string, uploadedBy: string) => void
}

export const useDocumentUploadsStore = create<DocumentUploadsState>((set) => ({
  uploadedByReturn: {},
  processingReturnId: null,
  upload: (returnId, type, fileName, uploadedBy) => {
    set({ processingReturnId: returnId })
    setTimeout(() => {
      uploadSequence += 1
      const document: Document = {
        id: `doc-upload-${uploadSequence}`,
        returnId,
        type,
        fileName,
        pageCount: 1,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        extractionStatus: "complete",
      }
      set((state) => ({
        processingReturnId: null,
        uploadedByReturn: {
          ...state.uploadedByReturn,
          [returnId]: [...(state.uploadedByReturn[returnId] ?? []), document],
        },
      }))
    }, 800)
  },
}))
