import { useParams } from "react-router"

import { getDocument, getReturn } from "@/data/fixtures"
import { documentLabel, returnLabel } from "@/lib/labels"
import { MockFormRenderer } from "@/components/documents/MockFormRenderer"
import { ThreadPanel } from "@/components/collab/ThreadPanel"

/**
 * A single document, rendered the same way ReturnReview's right pane does, with its own
 * conversation underneath — ThreadPanel's other mount point, scoped to this document via
 * :docId the same way ReturnReview scopes it to the selected field via ?field=.
 */
export function DocumentViewer() {
  const { docId } = useParams()
  const doc = docId ? getDocument(docId) : undefined
  const ret = doc ? getReturn(doc.returnId) : undefined

  if (!doc || !ret) {
    return (
      <main className="p-10">
        <p className="text-sm text-ink/60">No document found.</p>
      </main>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/50">{returnLabel(ret)}</p>
        <h1 className="font-display text-lg font-bold uppercase tracking-wide">{documentLabel(doc)}</h1>
      </header>
      <MockFormRenderer document={doc} />
      <ThreadPanel className="mt-8" />
    </div>
  )
}

export default DocumentViewer
