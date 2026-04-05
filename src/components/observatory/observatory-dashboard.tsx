"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, List, BarChart3, Link2, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useObservatory } from "./use-observatory";
import { Skeleton } from "@/components/ui/skeleton";
import { OWASP_RISKS } from "@/lib/observatory/risk-classifier";
import { PermissionGraph } from "./permission-graph";

export function ObservatoryDashboard() {
  const { stats, tokenStates, events, loading } = useObservatory(2000);

  const handleRevoke = async (connection: string, service: string) => {
    try {
      await fetch("/api/observatory/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection, service }),
      });
    } catch (err) {
      console.error("Revoke failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="audit" className="space-y-6">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="audit" className="gap-2">
            <List className="h-4 w-4" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="correlation" className="gap-2">
            <Link2 className="h-4 w-4" />
            Correlation
          </TabsTrigger>
          <TabsTrigger value="owasp" className="gap-2">
            <Shield className="h-4 w-4" />
            OWASP Risk Map
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            const res = await fetch("/api/observatory/report");
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `observatory-report-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export Report
        </Button>
      </div>

      <TabsContent value="audit">
        <AuditTrail events={events} />
      </TabsContent>

      <TabsContent value="correlation">
        <CredentialCorrelation />
      </TabsContent>

      <TabsContent value="owasp">
        <OWASPRiskMap events={events} />
      </TabsContent>

      <TabsContent value="permissions">
        <PermissionGraph
          events={events}
          tokenStates={tokenStates}
          stats={stats}
          onRevoke={handleRevoke}
        />
      </TabsContent>
    </Tabs>
  );
}

function AuditTrail({
  events,
}: {
  events: Array<{
    id: string;
    timestamp: number;
    type: string;
    tool: string;
    service: string;
    scopes: string[];
    riskLevel: string;
    owaspCategories: string[];
    outcome: string;
    details: Record<string, unknown>;
    duration?: number;
  }>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const filtered =
    filter === "all" ? events : events.filter((e) => e.service === filter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Full Audit Trail
          </CardTitle>
          <div className="flex gap-1">
            {["all", "google", "github", "slack"].map((f) => (
              <Badge
                key={f}
                variant={filter === f ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No events recorded yet. Use the Agent Chat to generate activity.
          </p>
        ) : (
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filtered
              .slice()
              .reverse()
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 py-2.5 px-3 rounded-md hover:bg-secondary/30 transition-colors"
                >
                  <div
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      event.outcome === "success"
                        ? "bg-green-500"
                        : event.outcome === "failure"
                          ? "bg-red-500"
                          : event.outcome === "interrupted"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString(
                          "en-US",
                          {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          }
                        )}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {event.type}
                      </Badge>
                      <span className="text-sm font-medium">{event.tool}</span>
                      <Badge
                        variant="secondary"
                        className="text-xs"
                      >
                        {event.service}
                      </Badge>
                      <RiskBadge level={event.riskLevel} />
                    </div>
                    {event.owaspCategories.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {event.owaspCategories.map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] font-mono text-muted-foreground bg-secondary/50 rounded px-1"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    {event.scopes.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {event.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="text-[10px] font-mono text-muted-foreground"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {event.duration && (
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {event.duration}ms
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OWASPRiskMap({
  events,
}: {
  events: Array<{ owaspCategories: string[]; riskLevel: string }>;
}) {
  // Count events per OWASP category
  const categoryCounts: Record<string, number> = {};
  events.forEach((e) => {
    e.owaspCategories.forEach((cat) => {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    });
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(
        Object.entries(OWASP_RISKS) as [
          string,
          { name: string; description: string },
        ][]
      ).map(([code, risk]) => {
        const count = categoryCounts[code] ?? 0;
        const hasEvents = count > 0;
        return (
          <Card
            key={code}
            className={
              hasEvents ? "border-yellow-500/30" : "border-border/30 opacity-70"
            }
          >
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-md text-xs font-mono font-bold ${
                    hasEvents
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {code}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{risk.name}</h3>
                    {hasEvents && (
                      <Badge variant="outline" className="text-xs">
                        {count} event{count !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {risk.description}
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant={hasEvents ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {hasEvents ? "Active — Mitigated" : "No Activity"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CredentialCorrelation() {
  const [service, setService] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<number>(15);
  const [correlations, setCorrelations] = useState<
    Array<{
      tokenExchange: { timestamp: number; tool: string; service: string; scopes: string[] };
      toolCalls: Array<{ timestamp: number; tool: string; outcome: string; duration?: number }>;
    }>
  >([]);

  const fetchCorrelations = useCallback(async () => {
    const params = new URLSearchParams({ view: "correlation" });
    if (service !== "all") params.set("service", service);
    params.set("since", String(Date.now() - timeRange * 60 * 1000));
    const res = await fetch(`/api/observatory/events?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCorrelations(data.correlations ?? []);
    }
  }, [service, timeRange]);

  useEffect(() => {
    // Initial fetch + polling — setState in effect is intentional for data sync
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCorrelations();
    const interval = setInterval(fetchCorrelations, 3000);
    return () => clearInterval(interval);
  }, [fetchCorrelations]);

  const totalExchanges = correlations.length;
  const totalToolCalls = correlations.reduce((sum, c) => sum + c.toolCalls.length, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Credential-Event Correlation (Pattern 1)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Which tool calls consumed credentials from each service?
            </p>
          </div>
          <div className="flex gap-2">
            {["all", "google", "github", "slack"].map((s) => (
              <Badge
                key={s}
                variant={service === s ? "default" : "outline"}
                className="cursor-pointer text-xs"
                role="button"
                tabIndex={0}
                onClick={() => setService(s)}
                onKeyDown={(e) => e.key === "Enter" && setService(s)}
              >
                {s === "all" ? "All" : s}
              </Badge>
            ))}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="text-xs bg-secondary/50 border border-border/50 rounded px-2 py-1"
              aria-label="Time range"
            >
              <option value={5}>5 min</option>
              <option value={15}>15 min</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3 mb-4">
          <p className="text-sm">
            <span className="font-bold text-primary">{totalToolCalls}</span> tool
            call{totalToolCalls !== 1 ? "s" : ""} consumed credentials from{" "}
            <span className="font-bold text-primary">{totalExchanges}</span> token
            exchange{totalExchanges !== 1 ? "s" : ""} in the last{" "}
            <span className="font-mono">{timeRange} min</span>
            {service !== "all" && (
              <>
                {" "}for <Badge variant="outline" className="text-xs">{service}</Badge>
              </>
            )}
          </p>
        </div>

        {/* Correlation pairs */}
        {correlations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No credential-event correlations found. Use the Agent Chat to
            generate activity.
          </p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {correlations.map((pair, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border/30 p-3"
              >
                {/* Token exchange (left) */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium">Token Exchange</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {pair.tokenExchange.service}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground pl-4">
                    {new Date(pair.tokenExchange.timestamp).toLocaleTimeString(
                      "en-US",
                      { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }
                    )}{" "}
                    — {pair.tokenExchange.tool}
                  </p>
                  {pair.tokenExchange.scopes.length > 0 && (
                    <div className="flex gap-1 flex-wrap pl-4">
                      {pair.tokenExchange.scopes.map((s) => (
                        <span
                          key={s}
                          className="text-[9px] font-mono text-muted-foreground bg-secondary/50 rounded px-1"
                        >
                          {s.split("/").pop() ?? s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connection arrow */}
                <div className="flex flex-col items-center pt-2 text-muted-foreground">
                  <span className="text-xs">→</span>
                  <span className="text-[9px]">{pair.toolCalls.length}x</span>
                </div>

                {/* Tool calls (right) */}
                <div className="flex-1 space-y-1">
                  {pair.toolCalls.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No tool calls consumed this token
                    </p>
                  ) : (
                    pair.toolCalls.map((call, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            call.outcome === "success"
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="text-[11px] font-mono">
                          {call.tool}
                        </span>
                        {call.duration && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {call.duration}ms
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low: "bg-green-500/10 text-green-500 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[level] ?? ""}`}>
      {level}
    </Badge>
  );
}
