#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  type CallToolResult,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getClient } from "./client.js";
import { handleToolCall, tools } from "./tools.js";

const server = new Server(
  { name: "vantage-postforme", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;
    // Resolve the SDK client lazily so tools/list works without credentials.
    const client = getClient();
    return handleToolCall(name, args ?? {}, client);
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[vantage-postforme] fatal:", error);
  process.exit(1);
});
