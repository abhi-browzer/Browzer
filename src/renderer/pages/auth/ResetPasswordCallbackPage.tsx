import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/ui/card';
import { Button } from '@/renderer/ui/button';
import { Input } from '@/renderer/ui/input';
import { Label } from '@/renderer/ui/label';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { toast } from 'sonner';

/**
 * Password Reset Callback Page
 * 
 * Handles magic link verification for password reset
 * URL: browzer://auth/reset-password?token_hash=xxx&type=recovery
 * 
 * Flow:
 * 1. Verify magic link token
 * 2. Show password reset form
 * 3. Update password
 * 4. Redirect to sign in
 */

type PageState = 'verifying' | 'reset_form' | 'success' | 'error';

export function ResetPasswordCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<PageState>('verifying');
  const [error, setError] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
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

      if (!accessToken) {
        setState('error');
        setError('Invalid reset link - missing access token');
        return;
      }

      // Store access token for password update
      setAccessToken(accessToken);
      setState('reset_form');
    } catch (err) {
      setState('error');
      setError('An unexpected error occurred');
      toast.error('Verification failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await window.authAPI.updatePassword(newPassword, accessToken);

      if (response.success) {
        setState('success');
        toast.success('Password updated successfully!');
        
        // Wait a moment then redirect to sign in
        setTimeout(() => {
          navigate('/auth/signin');
        }, 2000);
      } else {
        toast.error(response.error?.message || 'Failed to update password');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            {state === 'verifying' && 'Verifying reset link...'}
            {state === 'reset_form' && 'Enter your new password'}
            {state === 'success' && 'Password updated successfully!'}
            {state === 'error' && 'Reset link invalid'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying reset link...
              </p>
            </div>
          )}

          {state === 'reset_form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-2">
                <p className="font-medium">Password Updated!</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to sign in...
                </p>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="text-center space-y-2">
                <p className="font-medium text-destructive">Reset Link Invalid</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={() => navigate('/auth/forgot-password')} variant="outline">
                  Request New Reset Link
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
