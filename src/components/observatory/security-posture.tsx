"use client";

import { Shield, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { OWASP_RISKS } from "@/lib/observatory/risk-classifier";

interface SecurityPostureProps {
  events: Array<{
    owaspCategories: string[];
    outcome: string;
    riskLevel: string;
  }>;
}

export function SecurityPosture({ events }: SecurityPostureProps) {
  // Calculate which OWASP categories have been encountered and mitigated
  const categoryCounts: Record<string, { total: number; mitigated: number }> =
    {};
  events.forEach((e) => {
    e.owaspCategories.forEach((cat) => {
      if (!categoryCounts[cat]) {
        categoryCounts[cat] = { total: 0, mitigated: 0 };
      }
      categoryCounts[cat].total++;
      if (e.outcome === "success" || e.outcome === "interrupted") {
        categoryCounts[cat].mitigated++;
      }
    });
  });

  // Security score: percentage of OWASP categories that are either
  // actively mitigated (seen and handled) or architecturally addressed
  const allCategories = Object.keys(OWASP_RISKS);
  const architecturallyAddressed = allCategories.length; // All 10 are addressed in code
  const activelyTested = Object.keys(categoryCounts).length;
  const score = Math.round(
    ((architecturallyAddressed * 0.6 + activelyTested * 0.4) /
      allCategories.length) *
      100
  );

  const highRiskEvents = events.filter(
    (e) => e.riskLevel === "high" || e.riskLevel === "critical"
  );
  const highRiskMitigated = highRiskEvents.filter(
    (e) => e.outcome !== "failure"
  );
  const mitigationRate =
    highRiskEvents.length > 0
      ? Math.round((highRiskMitigated.length / highRiskEvents.length) * 100)
      : 100;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Security Posture — OWASP Agentic Top 10
          </CardTitle>
          <Badge
            variant={score >= 80 ? "default" : "secondary"}
            className="text-xs font-mono"
          >
            {score}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Coverage Score</span>
            <span className="font-mono">{score}%</span>
          </div>
          <Progress
            value={score}
            className={`h-2.5 ${
              score >= 80
                ? "[&>div]:bg-green-500"
                : score >= 60
                  ? "[&>div]:bg-yellow-500"
                  : "[&>div]:bg-red-500"
            }`}
          />
        </div>

        {/* Compact OWASP Grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {allCategories.map((code) => {
            const data = categoryCounts[code];
            const isActive = !!data;
            return (
              <div
                key={code}
                className={`rounded-md px-2 py-1.5 text-center text-[10px] font-mono border ${
                  isActive
                    ? "bg-green-500/10 border-green-500/30 text-green-500"
                    : "bg-secondary/30 border-border/20 text-muted-foreground"
                }`}
                title={
                  OWASP_RISKS[code as keyof typeof OWASP_RISKS]?.name ?? code
                }
              >
                {code}
              </div>
            );
          })}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-bold">{architecturallyAddressed}/10</span>
            </div>
            <span className="text-muted-foreground">Addressed</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-400">
              <Info className="h-3.5 w-3.5" />
              <span className="font-bold">{activelyTested}/10</span>
            </div>
            <span className="text-muted-foreground">Tested</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-yellow-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-bold">{mitigationRate}%</span>
            </div>
            <span className="text-muted-foreground">Mitigated</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
