import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/ui/card';
import { Button } from '@/renderer/ui/button';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';

/**
 * Email Verification Page
 * Route: /auth/verify-email
 * 
 * Handles email verification from link sent to user
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. Please check your email and try again.');
        return;
      }

      try {
        // TODO: Implement email verification via IPC
        // const result = await window.authAPI.verifyEmail(token);
        
        // Simulated verification for now
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setStatus('success');
        setMessage('Your email has been verified successfully!');
        
        // Redirect to sign in after 3 seconds
        setTimeout(() => {
          navigate('/auth/signin');
        }, 3000);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Failed to verify email. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <AuthLayout>
       <Card className="shadow-xl">
          <CardHeader>
            <div className="flex justify-center mb-4">
              {status === 'verifying' && (
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-12 w-12 text-green-600" />
              )}
              {status === 'error' && (
                <XCircle className="h-12 w-12 text-red-600" />
              )}
            </div>
            <CardTitle className="text-center">
              {status === 'verifying' && 'Verifying Email'}
              {status === 'success' && 'Email Verified'}
              {status === 'error' && 'Verification Failed'}
            </CardTitle>
            <CardDescription className="text-center">
              {message}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {status === 'success' && (
              <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-4">
                Redirecting to sign in...
              </p>
            )}
            
            {status === 'error' && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/auth/signup')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/auth/signin')}
                >
                  Back to Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
    </AuthLayout>
  );
}
