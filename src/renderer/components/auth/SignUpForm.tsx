import { useState } from 'react';
import { useAuth } from '@/renderer/hooks/useAuth';
import { Button } from '@/renderer/ui/button';
import { Input } from '@/renderer/ui/input';
import { Label } from '@/renderer/ui/label';
import { Alert, AlertDescription } from '@/renderer/ui/alert';
import { Loader2, Mail, Lock, User, Chrome } from 'lucide-react';
import { Separator } from '@/renderer/ui/separator';

/**
 * SignUpForm - Email/password and Google sign up form
 */
export function SignUpForm() {
  const { signUp, signInWithGoogle, loading, error } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (pass: string, confirm: string) => {
    if (pass.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    if (pass !== confirm) {
      setPasswordError('Passwords do not match');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      return;
    }

    if (!validatePassword(password, confirmPassword)) {
      return;
    }

    const result = await signUp({ 
      email, 
      password,
      displayName: displayName || undefined
    });

    if (result.success) {
      // Show success message
      alert('Account created successfully! Please check your email to verify your account.');
    }
  };

  const handleGoogleSignUp = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {passwordError && (
        <Alert variant="destructive">
          <AlertDescription>{passwordError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name (Optional)</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="displayName"
              type="text"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="signup-email"
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
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (confirmPassword) {
                  validatePassword(e.target.value, confirmPassword);
                }
              }}
              disabled={loading}
              className="pl-10"
              required
            />
          </div>
          <p className="text-xs text-slate-500">
            Must be at least 6 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                validatePassword(password, e.target.value);
              }}
              disabled={loading}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !email || !password || !confirmPassword || !!passwordError}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
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
        onClick={handleGoogleSignUp}
        disabled={loading}
      >
        <Chrome className="mr-2 h-4 w-4" />
        Sign up with Google
      </Button>
    </div>
  );
}
