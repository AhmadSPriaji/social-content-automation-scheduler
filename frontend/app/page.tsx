import Link from "next/link";
import { ArrowRight, CalendarDays, Share2, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center justify-center gap-2" href="/">
          <Share2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight text-primary">AutoSocial</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-primary transition-colors flex items-center" href="/login">
            Login
          </Link>
          <Link className={cn(buttonVariants({ size: "sm" }), "rounded-full")} href="/register">
            Get Started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 lg:py-48 flex flex-col items-center justify-center text-center px-4 md:px-6">
          <div className="space-y-4 max-w-4xl mx-auto flex flex-col items-center">
            <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary mb-4 border border-primary/20">
              New: AI-Powered Scheduling
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600 pb-2">
              Automate Your Social Media Presence
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl lg:text-2xl mt-6">
              Schedule posts, manage multiple workspaces, and grow your audience effortlessly from one unified dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto justify-center">
              <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 text-md group")}>
                Start for free
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-8 text-md")}>
                Sign in to Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/30 border-t">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <CalendarDays className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Smart Scheduling</h3>
                <p className="text-muted-foreground">Plan your content weeks in advance and let our system publish it at the perfect time.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                  <Share2 className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold">Multi-Platform</h3>
                <p className="text-muted-foreground">Manage all your social media accounts across different workspaces seamlessly.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4 sm:col-span-2 lg:col-span-1">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                  <Zap className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold">Lightning Fast</h3>
                <p className="text-muted-foreground">Built on modern architecture ensuring your dashboard is always responsive and quick.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full flex flex-col sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          © 2026 AutoSocial Scheduler. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6 mt-4 sm:mt-0">
          <Link className="text-xs hover:underline underline-offset-4 text-muted-foreground" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4 text-muted-foreground" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
