import { tool } from "ai";
import { z } from "zod";
import { google } from "googleapis";
import { getIdentityToken } from "@/lib/auth0-ai";
import { recordEvent, updateTokenState } from "@/lib/observatory/event-store";
import { classifyToolRisk } from "@/lib/observatory/risk-classifier";
import { canAccessService, isScopeDenied } from "@/lib/fga/model";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

export const checkCalendarAvailability = tool({
    description:
      "Check if the user is free or busy during a specific time range on Google Calendar",
    inputSchema: z.object({
      timeMin: z
        .string()
        .describe("Start time in ISO 8601 format (e.g., 2026-04-03T09:00:00Z)"),
      timeMax: z
        .string()
        .describe("End time in ISO 8601 format (e.g., 2026-04-03T17:00:00Z)"),
    }),
    execute: async ({ timeMin, timeMax }) => {
      // FGA authorization check (OWASP ASI03/ASI06)
      const auth0Module = await import("@/lib/auth0");
      const session = await auth0Module.auth0.getSession();
      if (session?.user?.sub && !canAccessService(session.user.sub, "google-calendar")) {
        recordEvent({
          type: "authorization_decision",
          tool: "check_calendar_availability",
          service: "google",
          scopes: SCOPES,
          riskLevel: "critical",
          owaspCategories: ["ASI03", "ASI06"],
          outcome: "failure",
          details: { reason: "FGA: user lacks Google Calendar access" },
        });
        return { error: "Access denied: you do not have permission to access Google Calendar." };
      }

      if (session?.user?.sub) {
        const deniedScope = SCOPES.find(s => isScopeDenied(session.user.sub, "google-calendar", s));
        if (deniedScope) {
          return { error: `Access denied: scope "${deniedScope}" has been disabled for Google Calendar.` };
        }
      }

      const startTime = Date.now();
      const { riskLevel, owaspCategories } = classifyToolRisk(
        "check_calendar_availability",
        SCOPES
      );

      recordEvent({
        type: "token_exchange",
        tool: "check_calendar_availability",
        service: "google",
        scopes: SCOPES,
        riskLevel,
        owaspCategories,
        outcome: "pending",
        details: { timeMin, timeMax },
      });

      try {
        const accessToken = await getIdentityToken("google-oauth2");
        if (!accessToken) throw new Error("Google Calendar not connected. Please connect your Google account.");
        updateTokenState("google", {
          service: "Google Calendar",
          connection: "google-oauth2",
          status: "connected",
          lastExchanged: Date.now(),
          scopes: SCOPES,
          healthScore: 100,
        });

        const calendar = getCalendarClient(accessToken);
        const res = await calendar.freebusy.query({
          requestBody: {
            timeMin,
            timeMax,
            items: [{ id: "primary" }],
          },
        });

        const busySlots = res.data.calendars?.primary?.busy ?? [];
        const duration = Date.now() - startTime;

        recordEvent({
          type: "tool_result",
          tool: "check_calendar_availability",
          service: "google",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "success",
          duration,
          details: {
            busySlotCount: busySlots.length,
            timeRange: { timeMin, timeMax },
          },
        });

        return {
          free: busySlots.length === 0,
          busySlots: busySlots.map((slot) => ({
            start: slot.start,
            end: slot.end,
          })),
          timeRange: { timeMin, timeMax },
        };
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        updateTokenState("google", {
          service: "Google Calendar",
          connection: "google-oauth2",
          status: "error",
          errorMessage: err.message,
          healthScore: 0,
        });

        recordEvent({
          type: "error",
          tool: "check_calendar_availability",
          service: "google",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "failure",
          duration: Date.now() - startTime,
          details: { error: err.message, status: err.status },
        });

        if (err.status === 401) {
          const { TokenVaultError } = await import("@auth0/ai/interrupts");
          throw new TokenVaultError("Authorization required to access Google Calendar");
        }
        throw error;
      }
    },
});

export const listCalendarEvents = tool({
    description:
      "List upcoming events from the user's Google Calendar within a time range",
    inputSchema: z.object({
      timeMin: z
        .string()
        .describe("Start time in ISO 8601 format"),
      timeMax: z
        .string()
        .describe("End time in ISO 8601 format"),
      maxResults: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of events to return"),
    }),
    execute: async ({ timeMin, timeMax, maxResults }) => {
      // FGA authorization check
      const auth0Module = await import("@/lib/auth0");
      const session = await auth0Module.auth0.getSession();
      if (session?.user?.sub && !canAccessService(session.user.sub, "google-calendar")) {
        return { error: "Access denied: you do not have permission to access Google Calendar." };
      }

      if (session?.user?.sub) {
        const deniedScope = SCOPES.find(s => isScopeDenied(session.user.sub, "google-calendar", s));
        if (deniedScope) {
          return { error: `Access denied: scope "${deniedScope}" has been disabled for Google Calendar.` };
        }
      }

      const startTime = Date.now();
      const { riskLevel, owaspCategories } = classifyToolRisk(
        "list_calendar_events",
        SCOPES
      );

      recordEvent({
        type: "token_exchange",
        tool: "list_calendar_events",
        service: "google",
        scopes: SCOPES,
        riskLevel,
        owaspCategories,
        outcome: "pending",
        details: { timeMin, timeMax, maxResults },
      });

      try {
        const accessToken = await getIdentityToken("google-oauth2");
        if (!accessToken) throw new Error("Google Calendar not connected. Please connect your Google account.");
        updateTokenState("google", {
          service: "Google Calendar",
          connection: "google-oauth2",
          status: "connected",
          lastExchanged: Date.now(),
          scopes: SCOPES,
          healthScore: 100,
        });

        const calendar = getCalendarClient(accessToken);
        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin,
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = (res.data.items ?? []).map((event) => ({
          id: event.id,
          summary: event.summary,
          start: event.start?.dateTime ?? event.start?.date,
          end: event.end?.dateTime ?? event.end?.date,
          location: event.location,
          status: event.status,
        }));

        recordEvent({
          type: "tool_result",
          tool: "list_calendar_events",
          service: "google",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "success",
          duration: Date.now() - startTime,
          details: { eventCount: events.length },
        });

        return { events, count: events.length };
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        recordEvent({
          type: "error",
          tool: "list_calendar_events",
          service: "google",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "failure",
          duration: Date.now() - startTime,
          details: { error: err.message },
        });

        if (err.status === 401) {
          const { TokenVaultError } = await import("@auth0/ai/interrupts");
          throw new TokenVaultError("Authorization required to access Google Calendar");
        }
        throw error;
      }
    },
});
