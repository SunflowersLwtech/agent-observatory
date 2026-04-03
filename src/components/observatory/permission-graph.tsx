"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Unplug, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface PermissionGraphProps {
  events: Array<{
    service: string;
    scopes: string[];
    riskLevel: string;
    outcome: string;
  }>;
  tokenStates: Array<{
    service: string;
    connection: string;
    status: string;
    healthScore: number;
    scopes: string[];
  }>;
  stats: {
    byService: { google: number; github: number; slack: number };
    byRisk: { low: number; medium: number; high: number; critical: number };
  } | null;
  onRevoke?: (connection: string, service: string) => void;
}

const SERVICE_COLORS: Record<string, string> = {
  google: "#3b82f6",
  github: "#a855f7",
  slack: "#22c55e",
};

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export function PermissionGraph({
  events,
  tokenStates,
  stats,
  onRevoke,
}: PermissionGraphProps) {
  // Scope toggle state (tracks which scopes are denied)
  const [deniedScopes, setDeniedScopes] = useState<Record<string, string[]>>({});

  // Fetch denied scopes on mount
  useEffect(() => {
    fetch("/api/observatory/scope-toggle")
      .then((r) => r.ok ? r.json() : { deniedScopes: {} })
      .then((d) => setDeniedScopes(d.deniedScopes ?? {}))
      .catch(() => {});
  }, []);

  const handleScopeToggle = useCallback(
    async (service: string, scope: string, enabled: boolean) => {
      // Optimistic update
      setDeniedScopes((prev) => {
        const svcDenied = new Set(prev[service] ?? []);
        if (enabled) svcDenied.delete(scope);
        else svcDenied.add(scope);
        return { ...prev, [service]: Array.from(svcDenied) };
      });

      try {
        const res = await fetch("/api/observatory/scope-toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, scope, enabled }),
        });
        if (res.ok) {
          const data = await res.json();
          setDeniedScopes(data.deniedScopes ?? {});
        }
      } catch {
        // Revert on error
        setDeniedScopes((prev) => {
          const svcDenied = new Set(prev[service] ?? []);
          if (enabled) svcDenied.add(scope);
          else svcDenied.delete(scope);
          return { ...prev, [service]: Array.from(svcDenied) };
        });
      }
    },
    []
  );

  // Service activity data for pie chart
  const serviceData = [
    { name: "Google", value: stats?.byService.google ?? 0, color: SERVICE_COLORS.google },
    { name: "GitHub", value: stats?.byService.github ?? 0, color: SERVICE_COLORS.github },
    { name: "Slack", value: stats?.byService.slack ?? 0, color: SERVICE_COLORS.slack },
  ].filter((d) => d.value > 0);

  // Risk distribution for radial bar
  const riskData = [
    { name: "Critical", value: stats?.byRisk.critical ?? 0, fill: RISK_COLORS.critical },
    { name: "High", value: stats?.byRisk.high ?? 0, fill: RISK_COLORS.high },
    { name: "Medium", value: stats?.byRisk.medium ?? 0, fill: RISK_COLORS.medium },
    { name: "Low", value: stats?.byRisk.low ?? 0, fill: RISK_COLORS.low },
  ];

  // Scope usage map
  const scopeUsage = new Map<string, number>();
  events.forEach((e) => {
    e.scopes.forEach((s) => {
      const short = s.split("/").pop() ?? s;
      scopeUsage.set(short, (scopeUsage.get(short) ?? 0) + 1);
    });
  });

  const services = [
    {
      key: "google",
      name: "Google Calendar",
      connection: "google-oauth2",
      color: SERVICE_COLORS.google,
      scopes: [
        { name: "calendar.freebusy", risk: "low", type: "read" },
        { name: "calendar.events.readonly", risk: "low", type: "read" },
      ],
    },
    {
      key: "github",
      name: "GitHub",
      connection: "github",
      color: SERVICE_COLORS.github,
      scopes: [
        { name: "repo", risk: "medium", type: "read+write" },
        { name: "read:user", risk: "low", type: "read" },
      ],
    },
    {
      key: "slack",
      name: "Slack",
      connection: "slack",
      color: SERVICE_COLORS.slack,
      scopes: [
        { name: "channels:read", risk: "low", type: "read" },
        { name: "chat:write", risk: "high", type: "write" },
        { name: "users:read", risk: "low", type: "read" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Service Activity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Service Activity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {serviceData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No activity yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {serviceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* OWASP Risk Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Level Gauge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="90%"
                data={riskData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={4}
                  label={{ position: "insideStart", fill: "#fff", fontSize: 11 }}
                />
                <Legend
                  iconSize={8}
                  layout="horizontal"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Tooltip />
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Permission Nodes — Visual Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Permission Landscape
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Central Agent Node */}
            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">AGENT</span>
                </div>
                {/* Pulse animation for active agent */}
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              </div>
            </div>

            {/* Service Nodes */}
            <div className="grid grid-cols-3 gap-4">
              {services.map((svc) => {
                const ts = tokenStates.find(
                  (t) => t.connection === svc.connection
                );
                const isConnected = ts?.status === "connected";
                const callCount =
                  stats?.byService[svc.key as keyof typeof stats.byService] ?? 0;

                return (
                  <div key={svc.key} className="relative">
                    {/* Connection line */}
                    <div
                      className={`absolute left-1/2 -top-8 w-0.5 h-8 ${
                        isConnected ? "bg-primary/40" : "bg-border/30"
                      }`}
                    />

                    <div
                      className={`rounded-xl border-2 p-4 transition-all ${
                        isConnected
                          ? "border-primary/30 bg-card"
                          : "border-border/20 bg-card/50 opacity-60"
                      }`}
                      style={{
                        borderColor: isConnected ? svc.color + "40" : undefined,
                      }}
                    >
                      {/* Service header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: svc.color }}
                          />
                          <span className="text-sm font-medium">
                            {svc.name}
                          </span>
                        </div>
                        <Badge
                          variant={isConnected ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {callCount} calls
                        </Badge>
                      </div>

                      {/* Scope nodes with toggle switches */}
                      <div className="space-y-2">
                        {svc.scopes.map((scope) => {
                          const usage = scopeUsage.get(scope.name) ?? 0;
                          const isDenied = (deniedScopes[svc.key] ?? []).includes(scope.name);
                          return (
                            <div
                              key={scope.name}
                              className={`flex items-center gap-2 ${isDenied ? "opacity-50" : ""}`}
                            >
                              <Switch
                                checked={!isDenied}
                                onCheckedChange={(checked) =>
                                  handleScopeToggle(svc.key, scope.name, checked)
                                }
                                className="scale-75"
                                aria-label={`Toggle ${scope.name} for ${svc.name}`}
                              />
                              <div
                                className={`h-6 flex-1 rounded-md flex items-center px-2 text-[10px] font-mono ${
                                  isDenied
                                    ? "bg-destructive/5 border border-destructive/20 line-through"
                                    : scope.type === "write"
                                      ? "bg-orange-500/10 border border-orange-500/20"
                                      : "bg-secondary/50 border border-border/20"
                                }`}
                              >
                                <span className="truncate">{scope.name}</span>
                                {usage > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[8px] ml-auto h-4 px-1"
                                  >
                                    {usage}x
                                  </Badge>
                                )}
                              </div>
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  isDenied
                                    ? "bg-destructive"
                                    : scope.risk === "high"
                                      ? "bg-orange-500"
                                    : scope.risk === "medium"
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Revoke button */}
                      {isConnected && onRevoke && (
                        <AlertDialog>
                          <AlertDialogTrigger className="w-full mt-3 text-xs text-destructive hover:text-destructive flex items-center justify-center gap-1 rounded-md px-3 py-1.5 hover:bg-destructive/10 transition-colors cursor-pointer">
                            <Unplug className="h-3 w-3" />
                            Revoke Access
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Revoke {svc.name} Access?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will disconnect the agent from {svc.name}.
                                The agent will no longer be able to access this
                                service until you reconnect.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  onRevoke(svc.connection, svc.key)
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
