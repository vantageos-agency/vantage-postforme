import type { PostForMe } from "post-for-me";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Platforms supported by Post For Me. Mirrors the SDK's platform union, plus
 * `tiktok_business` which the SDK exposes on social-account creation.
 */
const PlatformEnum = z.enum([
  "tiktok",
  "tiktok_business",
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "pinterest",
  "bluesky",
  "threads",
  "youtube",
]);

const PostStatusEnum = z.enum(["draft", "scheduled", "processing", "processed"]);

// ---------------------------------------------------------------------------
// Input schemas (zod). JSON Schema is derived at export time.
// ---------------------------------------------------------------------------

const ListSocialAccountsInput = z.object({
  platform: PlatformEnum.optional().describe(
    "Filter accounts by a single platform. Omit to list every connected account.",
  ),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

const GetSocialAccountAuthUrlInput = z.object({
  platform: PlatformEnum.describe(
    "Platform to authenticate against. The returned URL starts that provider's OAuth flow.",
  ),
  external_id: z
    .string()
    .optional()
    .describe("Your internal identifier — attach it so webhooks can match the account back."),
  redirect_url: z
    .string()
    .url()
    .optional()
    .describe(
      "Override the default OAuth redirect URL. Must be pre-registered in your Post For Me dashboard.",
    ),
});

const MediaItem = z.object({
  url: z.string().url().describe("Publicly accessible media URL."),
});

const PublishPostInput = z.object({
  caption: z.string().min(1).describe("Post body text."),
  social_accounts: z
    .array(z.string().min(1))
    .min(1)
    .describe("Social account IDs (from list_social_accounts) to publish to."),
  media: z.array(MediaItem).optional().describe("Optional media attachments (images, videos)."),
  scheduled_at: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 datetime. If omitted, the post publishes immediately."),
  platform_configurations: z
    .record(z.unknown())
    .optional()
    .describe(
      "Per-platform overrides (e.g. { x: { caption: '...' }, linkedin: { title: '...' } }).",
    ),
  external_id: z
    .string()
    .optional()
    .describe("Your internal reference ID. Echoed back in webhooks and list_posts."),
});

const ListPostsInput = z.object({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  status: PostStatusEnum.optional(),
});

const GetPostInput = z.object({
  post_id: z.string().min(1),
});

const DeletePostInput = z.object({
  post_id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // zod-to-json-schema returns a JSON Schema-compliant object. The MCP spec
  // requires `type: object` at the top level, which zod object schemas provide.
  const result = zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" });
  // Strip the top-level $schema key — MCP validators choke on it.
  if (typeof result === "object" && result !== null && "$schema" in result) {
    delete (result as Record<string, unknown>).$schema;
  }
  return result as Record<string, unknown>;
}

export const tools: ToolDefinition[] = [
  {
    name: "list_social_accounts",
    description:
      "List connected social accounts. Filter by platform, paginate with limit/offset.",
    inputSchema: toJsonSchema(ListSocialAccountsInput),
  },
  {
    name: "get_social_account_auth_url",
    description:
      "Generate an OAuth URL to connect a new social account. Hand the returned `url` to the end user to visit.",
    inputSchema: toJsonSchema(GetSocialAccountAuthUrlInput),
  },
  {
    name: "publish_post",
    description:
      "Create and publish (or schedule) a post to one or more connected social accounts. Omit `scheduled_at` to publish immediately.",
    inputSchema: toJsonSchema(PublishPostInput),
  },
  {
    name: "list_posts",
    description: "List posts (scheduled, processing, processed, draft) with pagination.",
    inputSchema: toJsonSchema(ListPostsInput),
  },
  {
    name: "get_post",
    description:
      "Fetch a single post by ID, including per-platform results and account-specific overrides.",
    inputSchema: toJsonSchema(GetPostInput),
  },
  {
    name: "delete_post",
    description: "Delete a scheduled or draft post. Returns { deleted: true } on success.",
    inputSchema: toJsonSchema(DeletePostInput),
  },
  {
    name: "preview_post",
    description:
      "Render a platform-specific preview of a post without publishing. Note: the official post-for-me SDK (v2.7.0) does not yet expose a preview resource; this tool will become available once the SDK ships `client.socialPostPreviews`. Calling it today returns a structured `unsupported` error.",
    inputSchema: toJsonSchema(PublishPostInput),
  },
];

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export interface ToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

function ok(value: unknown): ToolCallResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function err(message: string, extra?: Record<string, unknown>): ToolCallResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message, ...(extra ?? {}) }, null, 2),
      },
    ],
    isError: true,
  };
}

function describeError(error: unknown): { message: string; status?: number } {
  if (error && typeof error === "object") {
    const e = error as { message?: string; status?: number };
    // Never leak the API key or full request headers; SDK errors carry the
    // message + status which is enough for the caller to act on.
    return {
      message: e.message ?? "Unknown Post For Me SDK error",
      ...(typeof e.status === "number" ? { status: e.status } : {}),
    };
  }
  return { message: String(error) };
}

export async function handleToolCall(
  name: string,
  rawArgs: unknown,
  client: PostForMe,
): Promise<ToolCallResult> {
  try {
    switch (name) {
      case "list_social_accounts": {
        const args = ListSocialAccountsInput.parse(rawArgs ?? {});
        // SDK's `platform` param is an array — wrap the single-platform input.
        const result = await client.socialAccounts.list({
          ...(args.platform ? { platform: [args.platform] } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
        });
        return ok(result);
      }

      case "get_social_account_auth_url": {
        const args = GetSocialAccountAuthUrlInput.parse(rawArgs ?? {});
        // SDK field is `redirect_url_override`, not `redirect_url`.
        const result = await client.socialAccounts.createAuthURL({
          platform: args.platform,
          ...(args.external_id !== undefined ? { external_id: args.external_id } : {}),
          ...(args.redirect_url !== undefined
            ? { redirect_url_override: args.redirect_url }
            : {}),
        });
        return ok(result);
      }

      case "publish_post": {
        const args = PublishPostInput.parse(rawArgs ?? {});
        const result = await client.socialPosts.create({
          caption: args.caption,
          social_accounts: args.social_accounts,
          ...(args.media ? { media: args.media } : {}),
          ...(args.scheduled_at ? { scheduled_at: args.scheduled_at } : {}),
          ...(args.platform_configurations
            ? {
                platform_configurations:
                  args.platform_configurations as Parameters<
                    typeof client.socialPosts.create
                  >[0]["platform_configurations"],
              }
            : {}),
          ...(args.external_id ? { external_id: args.external_id } : {}),
        });
        return ok(result);
      }

      case "list_posts": {
        const args = ListPostsInput.parse(rawArgs ?? {});
        const result = await client.socialPosts.list({
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
          ...(args.status ? { status: [args.status] } : {}),
        });
        return ok(result);
      }

      case "get_post": {
        const args = GetPostInput.parse(rawArgs ?? {});
        // SDK uses `retrieve`, not `get`.
        const result = await client.socialPosts.retrieve(args.post_id);
        return ok(result);
      }

      case "delete_post": {
        const args = DeletePostInput.parse(rawArgs ?? {});
        await client.socialPosts.delete(args.post_id);
        return ok({ deleted: true, post_id: args.post_id });
      }

      case "preview_post": {
        // Validate input so callers get the same schema contract as publish_post,
        // but surface a clean unsupported error: the SDK does not expose a
        // preview resource as of post-for-me@2.7.0. The tool exists so skills
        // and agents can code against a stable name and automatically benefit
        // once the SDK ships `client.socialPostPreviews`.
        PublishPostInput.parse(rawArgs ?? {});
        return err(
          "preview_post is not yet supported by the official post-for-me SDK (v2.7.0).",
          {
            code: "sdk_unsupported",
            remediation:
              "Track https://github.com/DayMoonDevelopment/post-for-me-typescript for a `socialPostPreviews` resource. When it ships, this tool will wire up automatically in a future release of @vantageos/vantage-postforme.",
          },
        );
      }

      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err("Invalid tool arguments", { issues: error.issues });
    }
    const described = describeError(error);
    return err(described.message, described.status ? { status: described.status } : undefined);
  }
}
