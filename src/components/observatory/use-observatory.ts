"use client";

import { useState, useEffect, useCallback } from "react";

interface EventStats {
  total: number;
  recent: number;
  byRisk: { low: number; medium: number; high: number; critical: number };
  byService: { google: number; github: number; slack: number };
  byOutcome: { success: number; failure: number; interrupted: number };
}

interface TokenState {
  service: string;
  connection: string;
  status: string;
  lastExchanged?: number;
  lastRefreshed?: number;
  expiresAt?: number;
  scopes: string[];
  errorMessage?: string;
  healthScore: number;
}

interface ObservatoryEvent {
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
}

export function useObservatory(pollInterval = 3000) {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [tokenStates, setTokenStates] = useState<TokenState[]>([]);
  const [events, setEvents] = useState<ObservatoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        fetch("/api/observatory/events?view=stats"),
        fetch("/api/observatory/events?limit=50"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setTokenStates(data.tokenStates);
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events);
      }
    } catch (err) {
      console.error("Observatory fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  return { stats, tokenStates, events, loading, refresh: fetchData };
}
