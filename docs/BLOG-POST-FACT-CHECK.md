# Blog Post Fact-Check Registry

Every factual claim in the blog post, with verification source and status.

## Verified Claims

| # | Claim | Source | Verification Method | Status |
|---|-------|--------|-------------------|--------|
| 1 | RSAC 2026: 5 vendors shipped agent identity frameworks | VentureBeat article | WebSearch confirmed URL exists and matches | VERIFIED |
| 2 | The 5 vendors: Cisco, CrowdStrike, Microsoft, IBM+Auth0+Yubico, Okta | misc-research.md citing VentureBeat | WebSearch confirmed | VERIFIED |
| 3 | "nothing in the stack validates what happens after authentication succeeds" | VentureBeat RSAC 2026 article | WebSearch confirmed exact framing | VERIFIED |
| 4 | OWASP Top 10 for Agentic Applications released Dec 2025 | genai.owasp.org | WebSearch confirmed, multiple sources | VERIFIED |
| 5 | OWASP: over 100 security researchers contributed | OWASP press release (prnewswire) | WebSearch confirmed | VERIFIED |
| 6 | ASI01-ASI10 codes and names | aikido.dev/blog (third-party summary) | WebFetch extracted exact table | VERIFIED |
| 7 | Token Vault built on RFC 8693 | auth0.com/ai/docs/intro/token-vault | WebFetch of doc + WebSearch confirmed | VERIFIED |
| 8 | Grant type: `urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token` | auth0.com/ai/docs/get-started/call-others-apis + auth0-org-deep-research.md code analysis | Cross-referenced official docs + source code | VERIFIED |
| 9 | 30+ pre-built integrations | auth0.com/ai/docs/integrations/overview | WebFetch: "34 available integrations" | VERIFIED |
| 10 | Issue #175: Federated Connection errors silently swallowed, OPEN | github.com/auth0/auth0-ai-js/issues/175 | `gh issue view` confirmed title+state | VERIFIED |
| 11 | Issue #66: Token Vault setup complexity, CLOSED | github.com/auth0-samples/auth0-ai-samples/issues/66 | `gh issue view` confirmed title+state | VERIFIED |
| 12 | South et al. ICML 2025 paper | icml.cc/virtual/2025/poster/40172 + arXiv:2501.09674 | WebSearch confirmed ICML listing + arXiv | VERIFIED |
| 13 | Goswami "Agentic JWT" paper | arXiv:2509.13597 | Listed in papers-research.md (agent compiled) | VERIFIED via research |
| 14 | OpenFGA is CNCF sandbox project | openfga.dev + Auth0 docs | Auth0 official docs state this | VERIFIED |
| 15 | CIBA requires Enterprise plan | auth0.com/docs CIBA page | WebSearch confirmed "Enterprise Plan or appropriate add-on" | VERIFIED |
| 16 | 6 active IETF Internet-Drafts on agent auth | papers-research.md + misc-research.md | Multiple drafts confirmed via datatracker references | VERIFIED |
| 17 | Token Vault ~10 configuration steps | Issue #66 detailed reproduction | Counted from issue body | VERIFIED |
| 18 | `getAccessTokenFromTokenVault()` function name | auth0-ai-js source code + official how-to docs | Multiple official code examples | VERIFIED |
| 19 | `TokenVaultInterrupt` class exists | auth0-ai-js source code analysis | auth0-org-deep-research.md confirmed from source | VERIFIED |
| 20 | `withTokenVault()` wrapper pattern | Official how-to guides | All 8 framework examples use this pattern | VERIFIED |

## Claims Requiring Post-Development Update

| # | Claim | What Needs Updating |
|---|-------|-------------------|
| A | "The application connects to three distinct external API domains" | Confirm after implementation works |
| B | "Every `getAccessTokenFromTokenVault()` call is wrapped in instrumentation" | Confirm implementation approach |
| C | "A diagnostic panel shows the state of each connected account's tokens" | Confirm UI implementation |
| D | "[GitHub repository link]" | Fill in actual repo URL |

## Intentionally NOT Claimed (Avoids Unverifiable Statements)

- We do NOT claim Auth0 Token Vault is "insecure" — we describe specific documented gaps
- We do NOT claim CIBA is used — CIBA requires Enterprise plan, we use interrupt mechanism
- We do NOT cite specific attack statistics without source (e.g., "91,000 attack sessions" from misc-research not used because source wasn't independently verified to original)
- We do NOT claim our patterns are "novel" — we say they "emerged from this work" and "we believe are relevant"
- We do NOT use the VentureBeat quote without attribution
- We do NOT claim the ICML paper endorses our approach — we cite its argument for delegation infrastructure
