import { tool } from "ai";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIdentityToken } from "@/lib/auth0-ai";
import { recordEvent, updateTokenState } from "@/lib/observatory/event-store";
import { classifyToolRisk } from "@/lib/observatory/risk-classifier";
import { canAccessService, isScopeDenied } from "@/lib/fga/model";

const SCOPES = ["repo", "read:user"];

export const listGitHubRepos = tool({
    description:
      "List the authenticated user's GitHub repositories, sorted by most recently updated",
    inputSchema: z.object({
      sort: z
        .enum(["updated", "created", "pushed", "full_name"])
        .optional()
        .default("updated")
        .describe("Sort field"),
      perPage: z
        .number()
        .optional()
        .default(10)
        .describe("Number of repos to return"),
    }),
    execute: async ({ sort, perPage }) => {
      // FGA authorization check
      const auth0Module = await import("@/lib/auth0");
      const session = await auth0Module.auth0.getSession();
      if (session?.user?.sub && !canAccessService(session.user.sub, "github")) {
        return { error: "Access denied: you do not have permission to access GitHub." };
      }

      if (session?.user?.sub) {
        const deniedScope = SCOPES.find(s => isScopeDenied(session.user.sub, "github", s));
        if (deniedScope) {
          return { error: `Access denied: scope "${deniedScope}" has been disabled for GitHub.` };
        }
      }

      const startTime = Date.now();
      const { riskLevel, owaspCategories } = classifyToolRisk(
        "list_github_repos",
        SCOPES
      );

      recordEvent({
        type: "token_exchange",
        tool: "list_github_repos",
        service: "github",
        scopes: SCOPES,
        riskLevel,
        owaspCategories,
        outcome: "pending",
        details: { sort, perPage },
      });

      try {
        const accessToken = await getIdentityToken("github");
        if (!accessToken) throw new Error("GitHub not connected. Please connect your GitHub account.");

        updateTokenState("github", {
          service: "GitHub",
          connection: "github",
          status: "connected",
          lastExchanged: Date.now(),
          scopes: SCOPES,
          healthScore: 100,
        });

        const octokit = new Octokit({ auth: accessToken });
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          sort,
          per_page: perPage,
          direction: "desc",
        });

        const repos = data.map((repo) => ({
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          isPrivate: repo.private,
          updatedAt: repo.updated_at,
          url: repo.html_url,
        }));

        recordEvent({
          type: "tool_result",
          tool: "list_github_repos",
          service: "github",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "success",
          duration: Date.now() - startTime,
          details: { repoCount: repos.length },
        });

        return { repos, count: repos.length };
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        updateTokenState("github", {
          service: "GitHub",
          connection: "github",
          status: "error",
          errorMessage: err.message,
          healthScore: 0,
        });

        recordEvent({
          type: "error",
          tool: "list_github_repos",
          service: "github",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "failure",
          duration: Date.now() - startTime,
          details: { error: err.message },
        });

        throw error;
      }
    },
});

export const listGitHubIssues = tool({
    description:
      "List open issues for a specific GitHub repository",
    inputSchema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      state: z
        .enum(["open", "closed", "all"])
        .optional()
        .default("open"),
      perPage: z.number().optional().default(10),
    }),
    execute: async ({ owner, repo, state, perPage }) => {
      // FGA authorization check
      const auth0Module = await import("@/lib/auth0");
      const session = await auth0Module.auth0.getSession();
      if (session?.user?.sub && !canAccessService(session.user.sub, "github")) {
        return { error: "Access denied: you do not have permission to access GitHub." };
      }

      if (session?.user?.sub) {
        const deniedScope = SCOPES.find(s => isScopeDenied(session.user.sub, "github", s));
        if (deniedScope) {
          return { error: `Access denied: scope "${deniedScope}" has been disabled for GitHub.` };
        }
      }

      const startTime = Date.now();
      const { riskLevel, owaspCategories } = classifyToolRisk(
        "list_github_issues",
        SCOPES
      );

      recordEvent({
        type: "token_exchange",
        tool: "list_github_issues",
        service: "github",
        scopes: SCOPES,
        riskLevel,
        owaspCategories,
        outcome: "pending",
        details: { owner, repo, state },
      });

      try {
        const accessToken = await getIdentityToken("github");
        if (!accessToken) throw new Error("GitHub not connected. Please connect your GitHub account.");
        const octokit = new Octokit({ auth: accessToken });
        const { data } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state,
          per_page: perPage,
        });

        const issues = data.map((issue) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          author: issue.user?.login,
          labels: issue.labels.map((l) =>
            typeof l === "string" ? l : l.name
          ),
          url: issue.html_url,
        }));

        recordEvent({
          type: "tool_result",
          tool: "list_github_issues",
          service: "github",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "success",
          duration: Date.now() - startTime,
          details: { issueCount: issues.length, repo: `${owner}/${repo}` },
        });

        return { issues, count: issues.length };
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        recordEvent({
          type: "error",
          tool: "list_github_issues",
          service: "github",
          scopes: SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "failure",
          duration: Date.now() - startTime,
          details: { error: err.message },
        });

        if (err.status === 401) {
          const { TokenVaultError } = await import("@auth0/ai/interrupts");
          throw new TokenVaultError("Authorization required to access GitHub");
        }
        throw error;
      }
    },
});
