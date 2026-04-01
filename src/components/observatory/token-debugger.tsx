"use client";

import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Unplug,
  Clock,
  Shield,
  Bug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useObservatory } from "./use-observatory";
import { Skeleton } from "@/components/ui/skeleton";

export function TokenDebugger() {
  const { tokenStates, events, loading, refresh } = useObservatory(2000);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  // Get error events for diagnostic
  const errorEvents = events.filter((e) => e.type === "error");
  const tokenExchangeEvents = events.filter((e) => e.type === "token_exchange");

  // Static config for all 3 services when no token states exist yet
  const services = [
    {
      key: "google",
      name: "Google Calendar",
      connection: "google-oauth2",
      icon: "🗓️",
      configSteps: [
        "Enable Token Exchange grant type",
        "Configure google-oauth2 social connection",
        "Enable 'Offline Access' permission",
        "Set Google OAuth app to Production mode",
        "Enable 'Connected Accounts for Token Vault'",
        "Enable MRRT policy",
        "Activate My Account API",
        "Enable 'Allow Offline Access' on API",
      ],
    },
    {
      key: "github",
      name: "GitHub",
      connection: "github",
      icon: "🐙",
      configSteps: [
        "Enable Token Exchange grant type",
        "Configure github social connection",
        "Enable 'Connected Accounts for Token Vault'",
        "Set required scopes: repo, read:user",
        "Enable MRRT policy",
        "Activate My Account API",
      ],
    },
    {
      key: "slack",
      name: "Slack",
      connection: "slack",
      icon: "💬",
      configSteps: [
        "Enable Token Exchange grant type",
        "Configure slack social connection",
        "Enable 'Connected Accounts for Token Vault'",
        "Set required scopes: channels:read, chat:write",
        "Enable MRRT policy",
        "Activate My Account API",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Diagnostic Banner */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Bug className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium mb-1">
                Token Vault Diagnostic Tool
              </h3>
              <p className="text-xs text-muted-foreground">
                This tool addresses the #1 developer pain point: Token Vault
                setup has no debugging feedback loop. The error{" "}
                <code className="text-xs bg-secondary px-1 rounded">
                  Federated connection Refresh Token not found
                </code>{" "}
                gives no indication of which configuration step failed. This
                debugger shows token state, exchange history, and error
                details.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ref:{" "}
                <span className="font-mono">
                  auth0-ai-samples#66, auth0-ai-js#175
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Service Cards */}
      <div className="grid gap-6">
        {services.map((svc) => {
          const state = tokenStates.find(
            (ts) => ts.connection === svc.connection
          );
          const svcErrors = errorEvents.filter(
            (e) => e.service === svc.key
          );
          const svcExchanges = tokenExchangeEvents.filter(
            (e) => e.service === svc.key
          );

          return (
            <ServiceDebugCard
              key={svc.key}
              service={svc}
              state={state}
              errors={svcErrors}
              exchanges={svcExchanges}
            />
          );
        })}
      </div>

      {/* Common Errors Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Common Token Vault Errors & Fixes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ErrorReference
            error="Federated connection Refresh Token not found"
            cause="Token Vault hasn't stored tokens for this user/connection"
            fix="Ensure: (1) Token Exchange grant enabled, (2) Social connection configured with 'Connected Accounts for Token Vault', (3) User has completed OAuth flow with the provider, (4) 'Offline Access' permission enabled"
            ref="auth0-ai-samples#66"
          />
          <Separator />
          <ErrorReference
            error="Silent failure — no error, no token"
            cause="Federated connection errors caught and silently discarded in SDK"
            fix="This is a known SDK bug (auth0-ai-js#175, OPEN). Check Auth0 logs at Dashboard > Monitoring > Logs. Agent Observatory's error capture layer works around this."
            ref="auth0-ai-js#175"
          />
          <Separator />
          <ErrorReference
            error="My Account API returns 404"
            cause="My Account API not enabled or MRRT not configured"
            fix="Enable both: (1) Auth0 Dashboard > Settings > API Authorization Settings > Enable My Account API, (2) Enable Multi-Resource Refresh Token (MRRT) policy"
            ref="Devpost Forum"
          />
          <Separator />
          <ErrorReference
            error="toSorted() is not a function"
            cause="Node.js version too old for Array.prototype.toSorted()"
            fix="Use Node.js 20+ or apply polyfill. ref: udplabs/auth0-ai#17"
            ref="auth0-ai#17"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceDebugCard({
  service,
  state,
  errors,
  exchanges,
}: {
  service: {
    key: string;
    name: string;
    connection: string;
    icon: string;
    configSteps: string[];
  };
  state?: {
    status: string;
    healthScore: number;
    lastExchanged?: number;
    lastRefreshed?: number;
    expiresAt?: number;
    scopes: string[];
    errorMessage?: string;
  };
  errors: Array<{ timestamp: number; details: Record<string, unknown> }>;
  exchanges: Array<{ timestamp: number; outcome: string }>;
}) {
  const status = state?.status ?? "not_initialized";
  const healthScore = state?.healthScore ?? 0;

  return (
    <Card
      className={
        status === "connected"
          ? "border-green-500/20"
          : status === "error"
            ? "border-red-500/20"
            : "border-border/30"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{service.icon}</span>
            <div>
              <CardTitle className="text-sm font-medium">
                {service.name}
              </CardTitle>
              <p className="text-xs font-mono text-muted-foreground">
                connection: {service.connection}
              </p>
            </div>
          </div>
          <StatusIcon status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Health Score</span>
            <span className="font-mono">{healthScore}/100</span>
          </div>
          <Progress
            value={healthScore}
            className={`h-2 ${
              healthScore > 80
                ? "[&>div]:bg-green-500"
                : healthScore > 40
                  ? "[&>div]:bg-yellow-500"
                  : "[&>div]:bg-red-500"
            }`}
          />
        </div>

        {/* Token Timeline */}
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Last Exchange</span>
            <p className="font-mono mt-1">
              {state?.lastExchanged
                ? new Date(state.lastExchanged).toLocaleTimeString()
                : "Never"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Exchanges</span>
            <p className="font-mono mt-1">{exchanges.length}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Errors</span>
            <p
              className={`font-mono mt-1 ${errors.length > 0 ? "text-destructive" : ""}`}
            >
              {errors.length}
            </p>
          </div>
        </div>

        {/* Active Scopes */}
        {state?.scopes && state.scopes.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Active Scopes</span>
            <div className="flex gap-1 flex-wrap mt-1">
              {state.scopes.map((scope) => (
                <Badge key={scope} variant="outline" className="text-[10px]">
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {state?.errorMessage && (
          <div className="bg-destructive/10 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">
                Error
              </span>
            </div>
            <p className="text-xs font-mono text-destructive/80">
              {state.errorMessage}
            </p>
          </div>
        )}

        {/* Config Checklist (shown when not connected) */}
        {status !== "connected" && (
          <div>
            <span className="text-xs text-muted-foreground">
              Configuration Checklist
            </span>
            <div className="mt-2 space-y-1">
              {service.configSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="h-4 w-4 rounded border border-border/50 flex items-center justify-center text-muted-foreground">
                    {i + 1}
                  </div>
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Error Log */}
        {errors.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Error History</span>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {errors
                .slice(-5)
                .reverse()
                .map((err, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono text-muted-foreground bg-secondary/30 rounded px-2 py-1"
                  >
                    <span>
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </span>
                    {" — "}
                    <span className="text-destructive">
                      {String(err.details.error ?? "Unknown error")}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      );
    case "error":
      return (
        <Badge className="gap-1 bg-red-500/10 text-red-500 border-red-500/20">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    case "refreshing":
      return (
        <Badge className="gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Refreshing
        </Badge>
      );
    default:
      return (
        <Badge className="gap-1" variant="outline">
          <Unplug className="h-3 w-3" />
          Not Connected
        </Badge>
      );
  }
}

function ErrorReference({
  error,
  cause,
  fix,
  ref: reference,
}: {
  error: string;
  cause: string;
  fix: string;
  ref: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <code className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
          {error}
        </code>
        <span className="text-[10px] font-mono text-muted-foreground">
          {reference}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Cause:</strong> {cause}
      </p>
      <p className="text-xs text-muted-foreground">
        <strong>Fix:</strong> {fix}
      </p>
    </div>
  );
}
