import { Toaster } from "@/renderer/ui/sonner"
import { ThemeProvider } from "@/renderer/ui/theme-provider"
import { BrowserChrome } from "@/renderer/components/BrowserChrome"
import { InternalRouter, useIsInternalPage } from "@/renderer/router/InternalRouter"
import { AuthGuard } from "@/renderer/components/auth"

function App() {
  const isInternalPage = useIsInternalPage()

  return (
    <ThemeProvider defaultTheme={isInternalPage ? "light" : "dark"} storageKey="vite-ui-theme">
      <AuthGuard>
        {isInternalPage ? (
          <InternalRouter />
        ) : (
          <BrowserChrome />
        )}
      </AuthGuard>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  )
}

export default App
