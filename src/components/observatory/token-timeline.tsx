"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineEvent {
  timestamp: number;
  service: string;
  riskLevel: string;
  outcome: string;
}

export function TokenTimeline({ events }: { events: TimelineEvent[] }) {
  // Bucket events into 30-second intervals
  const now = Date.now();
  const bucketSize = 30_000; // 30 seconds
  const bucketCount = 20; // 10 minutes of data

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = now - (bucketCount - i) * bucketSize;
    const bucketEnd = bucketStart + bucketSize;
    const bucketEvents = events.filter(
      (e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd
    );

    return {
      time: new Date(bucketStart).toLocaleTimeString("en-US", {
        hour12: false,
        minute: "2-digit",
        second: "2-digit",
      }),
      google: bucketEvents.filter((e) => e.service === "google").length,
      github: bucketEvents.filter((e) => e.service === "github").length,
      slack: bucketEvents.filter((e) => e.service === "slack").length,
      highRisk: bucketEvents.filter(
        (e) => e.riskLevel === "high" || e.riskLevel === "critical"
      ).length,
    };
  });

  const hasData = events.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Token Exchange Timeline (Last 10 min)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No token exchanges recorded yet. Start a conversation with the
            agent.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={buckets}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="google"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name="Google"
              />
              <Area
                type="monotone"
                dataKey="github"
                stackId="1"
                stroke="#a855f7"
                fill="#a855f7"
                fillOpacity={0.3}
                name="GitHub"
              />
              <Area
                type="monotone"
                dataKey="slack"
                stackId="1"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.3}
                name="Slack"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
