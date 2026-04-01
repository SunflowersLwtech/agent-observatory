import { ObservatoryDashboard } from "@/components/observatory/observatory-dashboard";

export default function ObservatoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Observatory</h1>
        <p className="text-muted-foreground mt-1">
          Real-time audit trail, OWASP risk assessment, and permission
          landscape for your AI agent.
        </p>
      </div>
      <ObservatoryDashboard />
    </div>
  );
}
