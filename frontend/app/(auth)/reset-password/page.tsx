'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, { message: 'Password must be at least 6 characters' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
      message: 'Password must contain uppercase, lowercase, and a number',
    }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing reset token');
      router.push('/login');
    }
  }, [token, router]);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!token) return;
    
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
      toast.success('Password reset successfully. You can now login.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password. The token may be expired.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
        <CardDescription>
          Enter your new password below.
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              {...form.register('newPassword')}
            />
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit" isLoading={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
