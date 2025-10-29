import { Toaster } from "@/renderer/ui/sonner"
import { ThemeProvider } from "@/renderer/ui/theme-provider"
import { AppRouter } from "@/renderer/router/AppRouter"

/**
 * Main App Component
 * 
 * Architecture:
 * - ThemeProvider: Handles dark/light mode
 * - AppRouter: Manages all routing (auth + protected routes)
 * - Toaster: Global toast notifications
 * 
 * Routing is now handled by React Router DOM:
 * - Public routes: /auth/* (signin, signup, forgot-password, verify-email)
 * - Protected routes: /* (main browser, internal pages)
 */

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="browzer-ui-theme">
      <AppRouter />
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  )
}

export default App
