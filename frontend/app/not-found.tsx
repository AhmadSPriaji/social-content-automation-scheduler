'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        404 - Page Not Found
      </h1>
      <p className="mt-4 text-muted-foreground max-w-[500px]">
        Oops! The page you are looking for doesn't exist. It might have been moved or deleted.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/dashboard" className={buttonVariants()}>Return to Dashboard</Link>
      </div>
    </div>
  );
}
