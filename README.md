# vantage-postforme

First-class MCP tools for social posting across nine platforms (TikTok,
Facebook, Instagram, X, LinkedIn, Pinterest, Bluesky, Threads, YouTube),
backed by the official [`post-for-me`](https://www.npmjs.com/package/post-for-me)
TypeScript SDK.

Built for the VantageOS / ElPi Corp orchestrator family (Pi, Tau, Phi, Sigma,
Eta, Omega). Works in any MCP client (Claude Code, Claude Desktop, Cursor).

## What it does

Exposes seven named MCP tools that wrap the Post For Me SDK so agents and
skills can call `publish_post` directly instead of writing SDK code in a Code
Mode sandbox. Replaces `post-for-me-mcp` (the official server) for use cases
that need discoverable, LLM-friendly tool names.

## Install (Claude Code)

Once published to npm:

```bash
claude plugin install @vantageos/vantage-postforme
```

Manual install (any MCP client):

```bash
claude mcp add vantage-postforme \
  --command "npx" --args "-y,@vantageos/vantage-postforme" \
  --env POST_FOR_ME_API_KEY=pfm_xxx
```

Or copy `.claude-plugin/mcp.json` into your `~/.claude.json`.

## Configure

Set one environment variable:

```bash
export POST_FOR_ME_API_KEY=pfm_xxxxxxxxxxxxxxxxxxxx
```

Optional: `POST_FOR_ME_BASE_URL` to target staging / a proxy / self-hosted.

Get a key at [postforme.dev](https://postforme.dev).

## Tools

| Tool | Does |
|------|------|
| `list_social_accounts` | List connected accounts; filter by platform, paginate. |
| `get_social_account_auth_url` | Generate an OAuth URL for a new platform connection. |
| `publish_post` | Publish or schedule a post to one or more accounts. |
| `list_posts` | List posts with filters (status, pagination). |
| `get_post` | Fetch a single post by ID with per-platform results. |
| `delete_post` | Delete a scheduled or draft post. |
| `preview_post` | Platform-specific preview (SDK support pending — see tool description). |

## Usage example

From an MCP client, call `publish_post`:

```json
{
  "caption": "VantageOS 0.4 ships today.",
  "social_accounts": ["acc_01HXY...", "acc_01HXZ..."],
  "media": [{ "url": "https://cdn.elpicorp.com/launch/hero.png" }],
  "scheduled_at": "2026-05-01T14:00:00Z"
}
```

## Development

```bash
git clone https://github.com/vantageos/vantage-postforme
cd vantage-postforme
npm install
npm run build
npm run dev   # runs src/server.ts via tsx over stdio
```

Quick smoke test (returns the seven tool definitions):

```bash
POST_FOR_ME_API_KEY=fake printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node dist/server.js
```

## Bundled skills + agents

- `skills/post/SKILL.md` — teaches agents how to compose and publish posts.
- `skills/connect-social-account/SKILL.md` — walks through the OAuth flow.
- `agents/content-publisher.md` — opinionated drafting agent with brand voice
  guidance for the orchestrator family.

## License

MIT © ElPi Corp, 2026.
