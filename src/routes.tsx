import { createBrowserRouter } from "react-router"

import { AppShell } from "@/components/shell/AppShell"
import { Home } from "@/pages/Home"
import { KitchenSink } from "@/pages/KitchenSink"
import { PlaceholderPage } from "@/pages/PlaceholderPage"
import { ReturnsIndex } from "@/pages/ReturnsIndex"
import { RootRedirect } from "@/pages/RootRedirect"
import { TokenProofSheet } from "@/pages/TokenProofSheet"

/**
 * AppShell is the layout route's element, so it persists across navigation — children swap
 * in its <Outlet /> rather than remounting the whole tree. Every route below is a
 * placeholder except /kitchen-sink and /tokens; each renders its own name plus whatever
 * params and search params the router resolved, so navigation can be verified before any
 * real screen exists.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: "home", element: <Home /> },
      { path: "returns", element: <ReturnsIndex /> },
      { path: "returns/:id", element: <PlaceholderPage name="ReturnOverview" /> },
      { path: "returns/:id/review", element: <PlaceholderPage name="ReturnReview" /> },
      { path: "returns/:id/documents", element: <PlaceholderPage name="DocumentExplorer" /> },
      { path: "returns/:id/documents/:docId", element: <PlaceholderPage name="DocumentViewer" /> },
      { path: "returns/:id/items", element: <PlaceholderPage name="OpenItems" /> },
      { path: "returns/:id/threads/:threadId", element: <PlaceholderPage name="ThreadView" /> },
      { path: "questionnaire/:sectionId", element: <PlaceholderPage name="Questionnaire" /> },
      { path: "kitchen-sink", element: <KitchenSink /> },
      { path: "tokens", element: <TokenProofSheet /> },
    ],
  },
])
