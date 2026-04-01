import { auth0 } from "@/lib/auth0";
import { OverviewDashboard } from "@/components/observatory/overview-dashboard";

export default async function DashboardPage() {
  const session = await auth0.getSession();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Agent Observatory</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {session?.user.name ?? "Agent Operator"}. Monitor your
          AI agent&apos;s post-authentication behavior in real time.
        </p>
      </div>
      <OverviewDashboard />
    </div>
  );
}
