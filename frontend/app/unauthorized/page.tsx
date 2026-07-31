'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        401 - Unauthorized
      </h1>
      <p className="mt-4 text-muted-foreground max-w-[500px]">
        You do not have permission to access this page. Please log in with an account that has the required privileges.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/login" className={buttonVariants()}>
          Go to Login
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
