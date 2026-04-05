"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useInterruptions } from "@auth0/ai-vercel/react";
import { useState, useRef, useEffect, useId, useCallback } from "react";
import { Send, Square, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChatInterface() {
  const chatId = useId();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, toolInterrupt } =
    useInterruptions((onError) =>
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useChat({
        transport: new DefaultChatTransport({ api: "/api/chat" }),
        id: chatId,
        onError: onError((err) => {
          console.error("Chat error:", err);
        }),
      })
    );

  const isLoading = status === "submitted" || status === "streaming";

  const toolConnectionMap: Record<string, { connection: string; scopes: string[] }> = {
    checkCalendarAvailability: { connection: "google-oauth2", scopes: ["https://www.googleapis.com/auth/calendar.freebusy", "https://www.googleapis.com/auth/calendar.events.readonly"] },
    listCalendarEvents: { connection: "google-oauth2", scopes: ["https://www.googleapis.com/auth/calendar.freebusy", "https://www.googleapis.com/auth/calendar.events.readonly"] },
    listGitHubRepos: { connection: "github", scopes: ["repo", "read:user"] },
    listGitHubIssues: { connection: "github", scopes: ["repo", "read:user"] },
    listSlackChannels: { connection: "slack", scopes: ["channels:read", "groups:read", "users:read"] },
    sendSlackMessage: { connection: "slack", scopes: ["channels:read", "chat:write"] },
  };

  const handleConnectAccount = useCallback((connection: string, scopes: string[]) => {
    // Use /auth/login (not /auth/connect) so the SDK exchanges the code
    // at /auth/callback and properly stores the session with connected account.
    const params = new URLSearchParams({
      connection,
      returnTo: "/close",
      prompt: "consent",
    });
    scopes.forEach((s) => params.append("connection_scope", s));
    const url = `/auth/login?${params.toString()}`;
    const popup = window.open(url, "_blank", "width=800,height=650,status=no,toolbar=no,menubar=no");
    if (!popup) {
      window.location.href = url;
      return;
    }
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
      }
    }, 1000);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-6 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Agent Chat</h2>
            <p className="text-xs text-muted-foreground">
              All actions are logged to the Observatory
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isLoading ? "default" : "secondary"}
              className="text-xs"
            >
              {status === "ready"
                ? "Ready"
                : status === "submitted"
                  ? "Thinking..."
                  : status === "streaming"
                    ? "Streaming"
                    : "Error"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg mb-2">
                Start a conversation with your AI agent
              </p>
              <p className="text-sm text-muted-foreground">
                Try: &quot;What&apos;s on my calendar this week?&quot; or
                &quot;Show my GitHub repos&quot; or &quot;List my Slack
                channels&quot;
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5"
                    : "space-y-2"
                }`}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <p
                        key={index}
                        className={`text-sm whitespace-pre-wrap ${
                          message.role !== "user"
                            ? "text-foreground"
                            : ""
                        }`}
                      >
                        {part.text}
                      </p>
                    );
                  }
                  if (isToolUIPart(part)) {
                    return (
                      <ToolCallCard
                        key={part.toolCallId}
                        toolName={getToolName(part)}
                        state={part.state}
                        onConnect={part.state === "output-error" ? () => {
                          const conn = toolConnectionMap[getToolName(part)];
                          if (conn) {
                            handleConnectAccount(conn.connection, conn.scopes);
                          }
                        } : undefined}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {isLoading && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce [animation-delay:0.1s]">
                    .
                  </span>
                  <span className="animate-bounce [animation-delay:0.2s]">
                    .
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Token Vault Consent Dialog — proper Connected Accounts flow */}
      {toolInterrupt && <ConsentDialog interrupt={toolInterrupt} />}

      {/* Input */}
      <div className="border-t border-border/50 px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-center gap-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your agent to check your calendar, repos, or channels..."
            className="flex-1 bg-secondary/50"
            disabled={isLoading}
            aria-label="Chat message input"
          />
          {isLoading ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={stop}
              aria-label="Stop generation"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function ToolCallCard({
  toolName,
  state,
  onConnect,
}: {
  toolName: string;
  state: string;
  onConnect?: () => void;
}) {
  const serviceMap: Record<string, { label: string; color: string }> = {
    checkCalendarAvailability: {
      label: "Google Calendar",
      color: "text-blue-400",
    },
    listCalendarEvents: { label: "Google Calendar", color: "text-blue-400" },
    listGitHubRepos: { label: "GitHub", color: "text-purple-400" },
    listGitHubIssues: { label: "GitHub", color: "text-purple-400" },
    listSlackChannels: { label: "Slack", color: "text-green-400" },
    sendSlackMessage: { label: "Slack", color: "text-yellow-400" },
  };

  const service = serviceMap[toolName] ?? {
    label: toolName,
    color: "text-muted-foreground",
  };

  return (
    <Card className="px-3 py-2 bg-secondary/30 border-border/30">
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className={`${service.color} text-xs`}>
          {service.label}
        </Badge>
        <span className="text-muted-foreground font-mono">{toolName}</span>
        {state === "output-error" && onConnect ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-6 text-xs gap-1"
            onClick={onConnect}
          >
            <ExternalLink className="h-3 w-3" />
            Connect {service.label}
          </Button>
        ) : (
          <Badge
            variant={state === "output-available" ? "default" : "secondary"}
            className="text-xs ml-auto"
          >
            {state === "input-streaming"
              ? "Preparing..."
              : state === "input-available"
                ? "Executing..."
                : state === "output-available"
                  ? "Complete"
                  : state}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function ConsentDialog({
  interrupt,
}: {
  interrupt: {
    name: string;
    code: string;
    connection?: string;
    requiredScopes?: string[];
    tool: { name: string };
    resume: () => void;
  };
}) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(() => {
    setConnecting(true);

    // Build the connect URL with connection and scopes
    const params = new URLSearchParams({
      connection: interrupt.connection ?? interrupt.name,
      returnTo: "/close",
    });
    if (interrupt.requiredScopes) {
      interrupt.requiredScopes.forEach((s) => params.append("scopes", s));
    }

    // Open popup for Auth0 Connected Accounts flow
    const url = `/auth/connect?${params.toString()}`;
    const popup = window.open(url, "_blank", "width=800,height=650,status=no,toolbar=no,menubar=no");

    if (!popup) {
      // Popup blocked — fall back to same-window redirect
      window.location.href = url;
      return;
    }

    // Poll for popup close, then resume the agent
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        setConnecting(false);
        interrupt.resume();
      }
    }, 1000);
  }, [interrupt]);

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Connect Account Required
          </DialogTitle>
          <DialogDescription>
            The agent needs access to{" "}
            <strong>{interrupt.connection ?? interrupt.tool?.name}</strong> to
            continue. You&apos;ll be redirected to authorize this connection
            via Auth0 Token Vault.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="default"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            {connecting ? "Connecting..." : "Connect Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
