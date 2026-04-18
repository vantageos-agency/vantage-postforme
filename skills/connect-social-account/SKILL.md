---
name: connect-social-account
description: Run the OAuth flow to connect a new social account via PostForMe
allowed-tools: [Bash, Read]
---

# Connect a social account

Use this skill when the user wants to add a new platform (TikTok, Facebook,
Instagram, X, LinkedIn, Pinterest, Bluesky, Threads, YouTube) to their
PostForMe workspace.

## Flow

1. **Ask which platform.** If the user said "add my LinkedIn", you already know.
   Otherwise ask explicitly — don't guess.
2. **Optionally ask for an `external_id`.** This is the user's internal
   identifier for the account. It lets downstream webhooks and reports match
   the account back to a workspace / tenant / user record. Skip if not relevant.
3. **Generate the auth URL.** Call `get_social_account_auth_url` with
   `{ platform, external_id?, redirect_url? }`. You get back `{ platform, url }`.
4. **Hand the URL to the user.** Print it exactly. Do **not** wrap it in
   Markdown — many terminals mangle long URLs inside `[text](url)`. Tell the
   user to open it in a browser, complete the OAuth consent, and come back.
5. **Confirm the connection.** Once the user says they've finished, call
   `list_social_accounts` (filter by `platform` if you know it). The newly
   connected account appears with `status: "connected"`. Read its `username`
   and `id` back to the user.

## Example

```json
// Call
{
  "tool": "get_social_account_auth_url",
  "args": { "platform": "linkedin", "external_id": "workspace_01HXY..." }
}

// Response
{
  "platform": "linkedin",
  "url": "https://api.postforme.dev/v1/oauth/linkedin/authorize?state=..."
}
```

After the user completes OAuth:

```json
// Call
{
  "tool": "list_social_accounts",
  "args": { "platform": "linkedin" }
}

// Response (truncated)
{
  "data": [
    {
      "id": "acc_01HXZ...",
      "platform": "linkedin",
      "username": "laurent-perello",
      "status": "connected"
    }
  ]
}
```

## Guardrails

- **`redirect_url` must be pre-registered** in the Post For Me dashboard for
  the provided key. If the user hands you a custom URL, confirm it's registered
  before calling the tool.
- **Bluesky is different.** Bluesky requires the app password + handle to be
  supplied through `platform_data.bluesky` — this is not exposed by
  `get_social_account_auth_url` today; use the Post For Me dashboard for
  Bluesky until the SDK adds this param.
- **Respect rate limits.** Do not generate auth URLs in a loop; each URL is
  single-use but the endpoint is rate-limited.
