import { Link } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  FileText,
  Users,
  Mail,
  Palette,
  History,
  ShieldCheck,
  ArrowRight,
  UploadCloud,
  Send,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Newsletter Publishing",
    description: "Upload PDF newsletters, theme them to match your brand, and send them out in a few clicks.",
  },
  {
    icon: Users,
    title: "Employee Directory",
    description: "Keep your recipient list current with bulk CSV/Excel import, search, and per-employee management.",
  },
  {
    icon: Mail,
    title: "Delivery Tracking",
    description: "Every send is logged permanently — see what was delivered, what failed, and retry in one click.",
  },
  {
    icon: Palette,
    title: "Custom Themes",
    description: "Design reusable email themes with your own colors, banner, and layout for a consistent look.",
  },
  {
    icon: History,
    title: "Full Audit Trail",
    description: "Every upload, send, and change is recorded — with a 30-day Recently Deleted safety net.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Admins and super admins get exactly the access they need, with secure session-based login.",
  },
];

const steps = [
  {
    icon: UploadCloud,
    step: "01",
    title: "Upload",
    description: "Add a PDF newsletter, give it a title and topic, and pick a theme — or use your default.",
  },
  {
    icon: Users,
    step: "02",
    title: "Target",
    description: "Send to every employee on file, or hand-pick specific recipients for a targeted update.",
  },
  {
    icon: Send,
    step: "03",
    title: "Send",
    description: "Emails go out through Resend with the PDF attached, themed to match your brand.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Track",
    description: "Delivery status, failures, and a full audit trail are all logged automatically.",
  },
];

export default function Home() {
  // No auto-redirect here: a logged-in admin can still open the homepage
  // on purpose and shouldn't get bounced straight to the dashboard. The
  // header/hero CTA adapts instead -- "Go to Dashboard" once we know who's
  // signed in.
  const { data: session, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const loggedIn = !!session?.loggedIn;
  const ctaHref = loggedIn ? "/dashboard" : "/login";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Sign In";

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5 font-semibold">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm">Newsletter Central</span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide mt-0.5">upGrad SOT</span>
            </div>
          </div>
          <Link href={ctaHref}>
            <Button size="sm" disabled={isLoading}>
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden"
        >
          <div className="absolute left-1/2 top-[-180px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Internal admin platform for upGrad School Of Technology
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mt-8 leading-[1.1]">
            Every uGSOT newsletter,
            <br />
            <span className="text-primary">one platform.</span>
          </h1>

          <p className="text-muted-foreground text-lg mt-6 max-w-xl mx-auto leading-relaxed">
            Upload, theme, target, and send corporate newsletters to your employees —
            with delivery tracking and a full audit trail on every single action.
          </p>

          <div className="flex items-center justify-center gap-3 mt-10">
            <Link href={ctaHref}>
              <Button size="lg" className="gap-2 shadow-sm" disabled={isLoading}>
                {loggedIn ? "Go to Dashboard" : "Sign In to Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">
                Explore Features
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {step.step}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block h-px flex-1 bg-border" />
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <step.icon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-xl mx-auto text-center mb-14">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase">Platform</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">Everything an admin needs</h2>
            <p className="text-muted-foreground mt-4">
              Built specifically for uGSOT's newsletter workflow — from first upload to final delivery report.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40"
              >
                <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-8 py-14 text-center shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]"
          />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to send your next newsletter?</h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Sign in with your admin credentials to get started.
            </p>
            <Link href={ctaHref}>
              <Button size="lg" className="gap-2 mt-7 shadow-sm" disabled={isLoading}>
                {loggedIn ? "Go to Dashboard" : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            Newsletter Central
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-6 text-xs text-muted-foreground text-center">
            <span>&copy; {new Date().getFullYear()} upGrad School Of Technology. All rights reserved.</span>
            <span>Access is restricted to authorized administrators.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
