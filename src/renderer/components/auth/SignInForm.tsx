import { useState } from 'react';
import { useAuth } from '@/renderer/hooks/useAuth';
import { Button } from '@/renderer/ui/button';
import { Input } from '@/renderer/ui/input';
import { Label } from '@/renderer/ui/label';
import { Loader2, Mail, Lock, Chrome } from 'lucide-react';
import { Separator } from '@/renderer/ui/separator';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

/**
 * SignInForm - Email/password and Google sign in form
 */
export function SignInForm() {
  const { signIn, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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


  return (
    <div className="space-y-4">
     
    </div>
  );
}
