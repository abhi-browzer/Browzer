import { useState } from 'react';
import { useAuth } from '@/renderer/hooks/useAuth';
import { Button } from '@/renderer/ui/button';
import { Input } from '@/renderer/ui/input';
import { Label } from '@/renderer/ui/label';
import { Alert, AlertDescription } from '@/renderer/ui/alert';
import { Loader2, Mail, Lock, Chrome } from 'lucide-react';
import { Separator } from '@/renderer/ui/separator';
import { toast } from 'sonner';

/**
 * SignInForm - Email/password and Google sign in form
 */
export function SignInForm() {
  const { signIn, signInWithGoogle, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter an email and password');
      return;
    }

    await signIn({ email, password }).then(() => {
      toast.success('Signed in successfully');
    }).catch((error) => {
      toast.error(error.message);
    });
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const isConfigError = error?.includes('not configured') || error?.includes('NOT_CONFIGURED');

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {isConfigError ? (
              <div className="space-y-2">
                <p className="font-semibold">Authentication Not Configured</p>
                <p className="text-sm">Please add Supabase credentials to your <code className="bg-red-900/30 px-1 rounded">.env</code> file. See <code className="bg-red-900/30 px-1 rounded">SETUP_AUTH.md</code> for instructions.</p>
              </div>
            ) : (
              error
            )}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setShowResetPassword(!showResetPassword)}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !email || !password}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <Chrome className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>

      {showResetPassword && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Enter your email above and we'll send you a password reset link.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              if (email) {
                await window.authAPI.resetPassword(email);
                alert('Password reset email sent! Check your inbox.');
                setShowResetPassword(false);
              }
            }}
            disabled={!email}
          >
            Send Reset Link
          </Button>
        </div>
      )}
    </div>
  );
}
