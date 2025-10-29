import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/renderer/components/auth/ProtectedRoute';
import { SignInPage, SignUpPage, ForgotPasswordPage, VerifyEmailPage } from '@/renderer/pages/auth';
import { BrowserChrome } from '@/renderer/components/BrowserChrome';
import { InternalRouter, useIsInternalPage } from './InternalRouter';

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
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        
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
        <Route path="*" element={<Navigate to="/auth/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
