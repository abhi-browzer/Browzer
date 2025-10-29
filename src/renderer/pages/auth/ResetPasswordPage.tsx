import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/ui/card';
import { Button } from '@/renderer/ui/button';
import { Input } from '@/renderer/ui/input';
import { Label } from '@/renderer/ui/label';
import { Alert, AlertDescription } from '@/renderer/ui/alert';
import { Loader2, Lock, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Reset Password Page
 * Route: /auth/reset-password
 * 
 * User enters OTP code and new password to reset their password
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      toast.error('Email address is required');
      navigate('/auth/forgot-password');
    }
  }, [email, navigate]);

  // Handle resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        if (digits.length === 6) {
          inputRefs.current[5]?.focus();
        }
      });
    }
  };

  const validatePassword = () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!validatePassword()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.authAPI.verifyPasswordResetOTP(email, otpCode, newPassword);

      if (result.success) {
        toast.success('Password reset successfully!');
        // Navigate to main app - user is now logged in
        navigate('/');
      } else {
        setError(result.error?.message || 'Invalid verification code');
        toast.error(result.error?.message || 'Password reset failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
      toast.error('Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setResending(true);
    setError(null);

    try {
      const result = await window.authAPI.resendPasswordResetOTP(email);

      if (result.success) {
        toast.success('Verification code sent! Check your email.');
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        toast.error(result.error || 'Failed to resend code');
      }
    } catch (err: any) {
      toast.error('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Browzer
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Your Intelligent Agentic Browser
          </p>
        </div>

        {/* Reset Password Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <CardTitle className="text-center">Reset Your Password</CardTitle>
            <CardDescription className="text-center">
              Enter the code sent to<br />
              <strong className="text-slate-900 dark:text-white">{email}</strong>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* OTP Input */}
            <div className="space-y-2">
              <Label className="text-center block">Verification Code</Label>
              <div className="flex gap-2 justify-center">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={loading}
                    className="w-12 h-12 text-center text-lg font-semibold"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center mt-2">
                Enter the 6-digit code from your email
              </p>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Must be at least 6 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Reset Button */}
            <Button
              onClick={handleResetPassword}
              disabled={loading || otp.join('').length !== 6 || !newPassword || !confirmPassword}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>

            {/* Resend Code */}
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Didn't receive the code?
              </p>
              <Button
                variant="ghost"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  'Resend Code'
                )}
              </Button>
            </div>

            {/* Back to Forgot Password */}
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth/forgot-password')}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Forgot Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Check your spam folder if you don't see the email</p>
          <p className="mt-2">The code expires in 10 minutes</p>
        </div>
      </div>
    </div>
  );
}
