import { SignUpForm } from '@/renderer/components/auth/SignUpForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/ui/card';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';

/**
 * Sign Up Page
 * Route: /auth/signup
 */
export function SignUpPage() {
  return (
    <AuthLayout>
       <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Sign up to get started with Browzer
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <SignUpForm />
            
            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{' '}
                <Link 
                  to="/auth/signin" 
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
    </AuthLayout>
  );
}
