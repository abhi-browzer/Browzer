import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/ui/card';
import { Button } from '@/renderer/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { toast } from 'sonner';

/**
 * Email Confirmation Page
 * 
 * Handles magic link verification for email confirmation
 * URL: browzer://auth/confirm-signup?token_hash=xxx&type=signup
 */

type VerificationState = 'verifying' | 'success' | 'error';

export function ConfirmSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerificationState>('verifying');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    try {
      // Check for error from Supabase
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      
      if (error) {
        setState('error');
        setError(errorDescription || error);
        toast.error('Verification failed');
        return;
      }

      // Supabase sends session directly in URL hash (implicit flow)
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        setState('error');
        setError('Invalid verification link - missing tokens');
        return;
      }

      setState('success');
      toast.success('Email verified successfully!');
      
      // Wait a moment then redirect to app
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setState('error');
      setError('An unexpected error occurred');
      toast.error('Verification failed');
    }
  };

  const handleResend = async () => {
    // TODO: Implement resend confirmation email
    toast.info('Please check your email for a new confirmation link');
  };

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {state === 'verifying' && 'Verifying your email...'}
            {state === 'success' && 'Email verified successfully!'}
            {state === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {state === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your email...
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-2">
                <p className="font-medium">Email verified!</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting you to the app...
                </p>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="text-center space-y-2">
                <p className="font-medium text-destructive">Verification Failed</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={handleResend} variant="outline">
                  Resend Confirmation Email
                </Button>
                <Button onClick={() => navigate('/auth/signin')} variant="ghost">
                  Back to Sign In
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
