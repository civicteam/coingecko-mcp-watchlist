import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as service from "./service";
import z from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { getCoinGeckoProxy, closeCoinGeckoProxy } from "./coingecko-proxy";

export async function createMcpServer() {
  const mcpServer = new McpServer({
    name: "CoinGecko MCP Watchlist Server",
    version: "1.0.0",
  });

  mcpServer.tool(
    "create-watchlist",
    "Create a new crypto watchlist",
    {
      name: z.string().describe("Name of the watchlist"),
      description: z.string().optional().describe("Optional description"),
      isPublic: z.boolean().optional().describe("Make watchlist public (default: false)")
    },
    async ({ name, description, isPublic }, extra) => {
      try {
        const user = extra.authInfo?.extra?.sub as string;
        const watchlist = service.createWatchlist(user, { name, description, isPublic });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(watchlist, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating watchlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  mcpServer.tool(
    "get-my-watchlists",
    "Get all watchlists for the authenticated user",
    {},
    async (input, extra) => {
      const user = extra.authInfo?.extra?.sub as string;
      const watchlists = service.getMyWatchlists(user);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(watchlists, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "add-coin-to-watchlist",
    "Add a cryptocurrency to a watchlist",
    {
      watchlistId: z.string().describe("ID of the watchlist"),
      coinId: z.string().describe("CoinGecko coin ID (e.g., 'bitcoin', 'ethereum')"),
      targetPrice: z.number().optional().describe("Optional target price for alerts"),
      notes: z.string().optional().describe("Optional notes about this coin")
    },
    async ({ watchlistId, coinId, targetPrice, notes }, extra) => {
      const user = extra.authInfo?.extra?.sub as string;
      const coin = service.addCoinToWatchlist(watchlistId, user, { 
        watchlistId,
        coinId, 
        targetPrice, 
        notes 
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(coin, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "get-watchlist",
    "Get a specific watchlist by ID",
    {
      watchlistId: z.string().describe("ID of the watchlist to retrieve")
    },
    async ({ watchlistId }, extra) => {
      const user = extra.authInfo?.extra?.sub as string;
      const watchlist = service.getWatchlist(watchlistId, user);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(watchlist, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "remove-coin-from-watchlist",
    "Remove a cryptocurrency from a watchlist",
    {
      watchlistId: z.string().describe("ID of the watchlist"),
      coinId: z.string().describe("CoinGecko coin ID to remove")
    },
    async ({ watchlistId, coinId }, extra) => {
      const user = extra.authInfo?.extra?.sub as string;
      service.removeCoinFromWatchlist(watchlistId, user, coinId);
      return {
        content: [
          {
            type: "text",
            text: `Successfully removed ${coinId} from watchlist ${watchlistId}`,
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "add-watchlist-note",
    "Add a note to a watchlist or specific coin",
    {
      watchlistId: z.string().describe("ID of the watchlist"),
      coinId: z.string().optional().describe("Optional coin ID for coin-specific notes"),
      content: z.string().describe("Note content")
    },
    async ({ watchlistId, coinId, content }, extra) => {
      const user = extra.authInfo?.extra?.sub as string;
      const note = service.addWatchlistNote(watchlistId, user, { watchlistId, content, coinId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(note, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "get-watchlist-notes",
    "Get notes for a watchlist",
    {
      watchlistId: z.string().describe("ID of the watchlist"),
      coinId: z.string().optional().describe("Optional coin ID to filter notes")
    },
    async ({ watchlistId, coinId }, extra) => {
      const user = extra.authInfo?.extra?.sub as string;
      const notes = service.getWatchlistNotes(watchlistId, user, coinId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(notes, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "get-public-watchlists",
    "Browse public watchlists from other users",
    {
      page: z.number().optional().describe("Page number (default: 1)"),
      limit: z.number().optional().describe("Items per page (default: 20)"),
      search: z.string().optional().describe("Search term"),
      tags: z.array(z.string()).optional().describe("Filter by tags")
    },
    async ({ page = 1, limit = 20, search, tags }, extra) => {
      const result = service.getPublicWatchlists({ page, limit, search, tags });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register CoinGecko tools dynamically
  try {
    const coinGeckoProxy = await getCoinGeckoProxy();
    const coinGeckoTools = await coinGeckoProxy.listTools();

    // Register each CoinGecko tool as a proxy
    for (const tool of coinGeckoTools) {
      // Convert JSON schema to Zod schema or use empty object
      const schema = tool.inputSchema?.properties
        ? Object.fromEntries(
            Object.entries(tool.inputSchema.properties).map(
              ([key, prop]: [string, any]) => [
                key,
                z
                  .any()
                  .optional()
                  .describe(prop.description || ""),
              ]
            )
          )
        : {};

      mcpServer.tool(
        `coingecko-${tool.name}`,
        tool.description || `CoinGecko tool: ${tool.name}`,
        schema,
        async (input, extra) => {
          try {
            const result = await coinGeckoProxy.callTool(tool.name, input);
            // Ensure the result conforms to expected format
            return {
              content: Array.isArray(result.content)
                ? result.content
                : [
                    {
                      type: "text",
                      text: JSON.stringify(result),
                    },
                  ],
            };
          } catch (error) {
            console.error(`Error calling CoinGecko tool ${tool.name}:`, error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error calling CoinGecko tool: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                },
              ],
            };
          }
        }
      );
    }

    console.log(`Registered ${coinGeckoTools.length} CoinGecko tools`);
  } catch (error) {
    console.error("Failed to register CoinGecko tools:", error);
    // Continue without CoinGecko tools if connection fails
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.connect(transport);

  return { transport, mcpServer };
}
