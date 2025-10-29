import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/renderer/components/auth/ProtectedRoute';
import { SignInPage, SignUpPage, ForgotPasswordPage, VerifyOTPPage } from '@/renderer/pages/auth';
import { ResetPasswordPage } from '@/renderer/pages/auth/ResetPasswordPage';
import { BrowserChrome } from '@/renderer/components/BrowserChrome';
import { InternalRouter, useIsInternalPage } from './InternalRouter';
import { useDeepLink } from '@/renderer/hooks/useDeepLink';
import NotFound from '@/renderer/pages/not-found';

function MainApp() {
  const isInternalPage = useIsInternalPage();
  
  return isInternalPage ? <InternalRouter /> : <BrowserChrome />;
}

function AppRoutes() {
  // Initialize global deep link handler (must be inside Router context)
  useDeepLink();

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/auth/signin" element={<SignInPage />} />
      <Route path="/auth/signup" element={<SignUpPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/verify-otp" element={<VerifyOTPPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      
      {/* Protected Main App Route */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        } 
      />
      
      {/* Fallback - redirect to signin */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
