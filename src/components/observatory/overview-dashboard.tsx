"use client";

import {
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useObservatory } from "./use-observatory";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenTimeline } from "./token-timeline";
import { SecurityPosture } from "./security-posture";
import { AnomalyGauge } from "./anomaly-gauge";

export function OverviewDashboard() {
  const { stats, tokenStates, events, anomaly, loading } = useObservatory();

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalRisk =
    (stats?.byRisk.high ?? 0) + (stats?.byRisk.critical ?? 0);
  const totalEvents = stats?.recent ?? 0;
  const successRate =
    totalEvents > 0
      ? Math.round(
          ((stats?.byOutcome.success ?? 0) / totalEvents) * 100
        )
      : 100;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          title="Events (5 min)"
          value={totalEvents}
          description="Total observatory events"
        />
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          title="Success Rate"
          value={`${successRate}%`}
          description={`${stats?.byOutcome.failure ?? 0} failures`}
          variant={successRate < 80 ? "destructive" : "default"}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="High Risk Ops"
          value={totalRisk}
          description="Operations requiring attention"
          variant={totalRisk > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          title="Connected Services"
          value={tokenStates.filter((t) => t.status === "connected").length}
          description={`of ${tokenStates.length || 3} configured`}
        />
      </div>

      {/* Security: OWASP Posture + Anomaly Detection */}
      <div className="grid gap-6 md:grid-cols-2">
        <SecurityPosture events={events} />
        <AnomalyGauge anomaly={anomaly} />
      </div>

      {/* Service Status + Risk Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Token Vault Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tokenStates.length === 0 ? (
              <>
                <ConnectionRow
                  service="Google Calendar"
                  connection="google-oauth2"
                  status="disconnected"
                  healthScore={0}
                />
                <ConnectionRow
                  service="GitHub"
                  connection="github"
                  status="disconnected"
                  healthScore={0}
                />
                <ConnectionRow
                  service="Slack"
                  connection="slack"
                  status="disconnected"
                  healthScore={0}
                />
              </>
            ) : (
              tokenStates.map((ts) => (
                <ConnectionRow
                  key={ts.connection}
                  service={ts.service}
                  connection={ts.connection}
                  status={ts.status}
                  healthScore={ts.healthScore}
                  lastExchanged={ts.lastExchanged}
                  errorMessage={ts.errorMessage}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* OWASP Risk Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Risk Distribution (Last 5 min)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RiskBar
              label="Low"
              count={stats?.byRisk.low ?? 0}
              total={totalEvents || 1}
              color="bg-green-500"
            />
            <RiskBar
              label="Medium"
              count={stats?.byRisk.medium ?? 0}
              total={totalEvents || 1}
              color="bg-yellow-500"
            />
            <RiskBar
              label="High"
              count={stats?.byRisk.high ?? 0}
              total={totalEvents || 1}
              color="bg-orange-500"
            />
            <RiskBar
              label="Critical"
              count={stats?.byRisk.critical ?? 0}
              total={totalEvents || 1}
              color="bg-red-500"
            />
          </CardContent>
        </Card>
      </div>

      {/* Token Exchange Timeline */}
      <TokenTimeline events={events} />

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No events yet. Start a conversation with the agent to see
              activity here.
            </p>
          ) : (
            <div className="space-y-2">
              {events.slice(-10).reverse().map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 text-sm py-2 border-b border-border/30 last:border-0"
                >
                  <EventIcon outcome={event.outcome} />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="mx-2 text-foreground">{event.tool}</span>
                    <Badge variant="outline" className="text-xs">
                      {event.service}
                    </Badge>
                  </div>
                  <RiskBadge level={event.riskLevel} />
                  {event.duration && (
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.duration}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  description,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  description: string;
  variant?: "default" | "destructive" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={
            variant === "destructive"
              ? "text-destructive"
              : variant === "warning"
                ? "text-yellow-500"
                : "text-muted-foreground"
          }
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function ConnectionRow({
  service,
  connection,
  status,
  healthScore,
  lastExchanged,
  errorMessage,
}: {
  service: string;
  connection: string;
  status: string;
  healthScore: number;
  lastExchanged?: number;
  errorMessage?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2 w-2 rounded-full ${
          status === "connected"
            ? "bg-green-500"
            : status === "error"
              ? "bg-red-500"
              : "bg-muted-foreground"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{service}</span>
          <Badge
            variant={status === "connected" ? "default" : "outline"}
            className="text-xs"
          >
            {status}
          </Badge>
        </div>
        {errorMessage && (
          <p className="text-xs text-destructive truncate">{errorMessage}</p>
        )}
        {lastExchanged && (
          <p className="text-xs text-muted-foreground">
            Last exchange: {new Date(lastExchanged).toLocaleTimeString()}
          </p>
        )}
      </div>
      <div className="w-16">
        <Progress value={healthScore} className="h-1.5" />
      </div>
    </div>
  );
}

function RiskBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-14">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">
        {count}
      </span>
    </div>
  );
}

function EventIcon({ outcome }: { outcome: string }) {
  if (outcome === "success")
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (outcome === "failure")
    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (outcome === "interrupted")
    return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <Activity className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low: "bg-green-500/10 text-green-500 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`text-xs ${styles[level] ?? ""}`}>
      {level}
    </Badge>
  );
}
