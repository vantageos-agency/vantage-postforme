import { PostForMe } from "post-for-me";

let cached: PostForMe | null = null;

/**
 * Lazily instantiate the official Post For Me SDK client.
 *
 * - Reads `POST_FOR_ME_API_KEY` at call time (not module load) so the MCP server
 *   can boot even when the env var is missing, and then fail cleanly on the
 *   first tool call.
 * - Honors `POST_FOR_ME_BASE_URL` for staging / self-hosted deployments.
 * - Caches the instance; subsequent calls reuse the same client.
 */
export function getClient(): PostForMe {
  if (cached) return cached;

  const apiKey = process.env.POST_FOR_ME_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "POST_FOR_ME_API_KEY is not set. Add it to your environment or MCP server config.",
    );
  }

  const baseURL = process.env.POST_FOR_ME_BASE_URL?.trim();

  cached = new PostForMe({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return cached;
}

/**
 * Reset the cached client. Exposed for tests — not used at runtime.
 */
export function resetClient(): void {
  cached = null;
}
