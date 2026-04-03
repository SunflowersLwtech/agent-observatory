"use client";

import { ShieldAlert, ShieldCheck, ShieldQuestion, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AnomalyGaugeProps {
  anomaly: {
    score: number;
    signals: Array<{
      type: string;
      severity: number;
      description: string;
      owaspCategory: string;
    }>;
    recommendation: string;
  } | null;
}

export function AnomalyGauge({ anomaly }: AnomalyGaugeProps) {
  const score = anomaly?.score ?? 0;
  const recommendation = anomaly?.recommendation ?? "normal";
  const signals = anomaly?.signals ?? [];

  const CONFIGS = {
    normal: {
      icon: ShieldCheck,
      color: "text-green-500",
      bg: "bg-green-500",
      border: "border-green-500/20",
      label: "Normal",
    },
    elevated: {
      icon: ShieldQuestion,
      color: "text-yellow-500",
      bg: "bg-yellow-500",
      border: "border-yellow-500/20",
      label: "Elevated",
    },
    step_up_required: {
      icon: ShieldAlert,
      color: "text-orange-500",
      bg: "bg-orange-500",
      border: "border-orange-500/20",
      label: "Step-Up Required",
    },
    block: {
      icon: Ban,
      color: "text-red-500",
      bg: "bg-red-500",
      border: "border-red-500/20",
      label: "Block",
    },
  } as const;

  const config = CONFIGS[recommendation as keyof typeof CONFIGS] ?? CONFIGS.normal;

  const Icon = config.icon;

  return (
    <Card className={config.border}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          Behavioral Anomaly Score
          <Badge variant="outline" className={`ml-auto text-xs ${config.color}`}>
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score arc */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {/* Background arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-secondary"
                strokeDasharray={`${2 * Math.PI * 40}`}
              />
              {/* Score arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className={config.color}
                strokeDasharray={`${(score / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold font-mono ${config.color}`}>
                {score}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {signals.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No anomalies detected. Agent behavior is within normal bounds.
              </p>
            ) : (
              signals.map((signal, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${config.bg}`}
                  />
                  <span className="text-muted-foreground flex-1">
                    {signal.description}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {signal.owaspCategory}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Signal types legend */}
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span>Velocity</span>
          <span>Cross-Service</span>
          <span>Scope Escalation</span>
          <span>Error Burst</span>
        </div>
      </CardContent>
    </Card>
  );
}
