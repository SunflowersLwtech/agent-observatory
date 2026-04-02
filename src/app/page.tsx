import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import {
  Shield,
  Eye,
  Activity,
  ArrowRight,
  Lock,
  Zap,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function LandingPage() {
  const session = await auth0.getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Agent Observatory</span>
          </div>
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign In <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-24 text-center">
          <Badge variant="secondary" className="mb-6">
            Built for the Auth0 &quot;Authorized to Act&quot; Hackathon
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            What happens{" "}
            <span className="text-primary">after</span> your agent
            authenticates?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
            Agent Observatory makes post-authentication AI agent behavior
            observable, auditable, and controllable. See every token exchange,
            every tool call, every authorization decision — in real time.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a href="/auth/login">
              <Button size="lg">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Activity className="h-5 w-5" />}
              title="Post-Auth Audit Trail"
              description="Every token exchange and tool call is logged with OWASP risk classification. No more silent failures."
              badge="Solves RSAC 2026 Gap"
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="OWASP Risk Dashboard"
              description="Real-time risk indicators mapped to the OWASP Top 10 for Agentic Applications. Scope-bound risk classification."
              badge="10 Risk Categories"
            />
            <FeatureCard
              icon={<Search className="h-5 w-5" />}
              title="Token Vault Debugger"
              description="Visualize token lifecycle, connection health, and error states. Debug Token Vault issues in seconds."
              badge="Developer Tool"
            />
            <FeatureCard
              icon={<Lock className="h-5 w-5" />}
              title="Interrupt-as-Circuit-Breaker"
              description="High-risk operations trigger step-up authorization via Auth0 interrupts, pausing agent execution for user approval."
              badge="Pattern"
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="3-Service Token Vault"
              description="Google Calendar, GitHub, and Slack integrated via Auth0 Token Vault with RFC 8693 token exchange."
              badge="3 APIs"
            />
            <FeatureCard
              icon={<Eye className="h-5 w-5" />}
              title="Permission Landscape"
              description="Visual map of every permission your agent holds, which ones it's using, and complete operation history."
              badge="Transparency"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <p>Agent Observatory &mdash; Post-auth observability for AI agents</p>
          <p>Built with Auth0 Token Vault, FGA, Next.js &amp; Vercel AI SDK</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <Badge variant="outline" className="text-xs">
            {badge}
          </Badge>
        </div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
