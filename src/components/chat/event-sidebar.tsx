"use client";

import { useObservatory } from "@/components/observatory/use-observatory";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Clock,
} from "lucide-react";

export function EventSidebar() {
  const { events } = useObservatory(2000);
  const recent = events.slice(-15).reverse();

  return (
    <div className="w-72 border-l border-border/50 flex flex-col bg-card/30">
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Live Activity</span>
          {recent.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {recent.length}
            </Badge>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              Events will appear here as the agent operates.
            </p>
          ) : (
            recent.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors"
              >
                <EventDot outcome={event.outcome} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium truncate">
                      {event.tool}
                    </span>
                    <RiskDot level={event.riskLevel} />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(event.timestamp).toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {event.service}
                    </span>
                    {event.duration && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                        <Clock className="h-2.5 w-2.5" />
                        {event.duration}ms
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function EventDot({ outcome }: { outcome: string }) {
  if (outcome === "success")
    return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />;
  if (outcome === "failure")
    return <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />;
  if (outcome === "interrupted")
    return (
      <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
    );
  return (
    <div className="h-3 w-3 flex items-center justify-center shrink-0 mt-0.5">
      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
    </div>
  );
}

function RiskDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  return (
    <div
      className={`h-1.5 w-1.5 rounded-full ${colors[level] ?? "bg-muted-foreground"}`}
      title={`Risk: ${level}`}
    />
  );
}
