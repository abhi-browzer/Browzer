import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/renderer/components/auth/ProtectedRoute';
import { SignInPage, SignUpPage, ForgotPasswordPage, VerifyOTPPage } from '@/renderer/pages/auth';
import { BrowserChrome } from '@/renderer/components/BrowserChrome';
import { InternalRouter, useIsInternalPage } from './InternalRouter';
import NotFound from '@/renderer/pages/not-found';

function MainApp() {
  const isInternalPage = useIsInternalPage();
  
  return isInternalPage ? <InternalRouter /> : <BrowserChrome />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/verify-otp" element={<VerifyOTPPage />} />
        
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
    </BrowserRouter>
  );
}
