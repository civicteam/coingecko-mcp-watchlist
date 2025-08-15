import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export class CoinGeckoMCPProxy {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private isConnected = false;
  private apiKey: string;
  private serverUrl: string;

  constructor(serverUrl?: string, apiKey?: string) {
    this.apiKey = apiKey || process.env.COINGECKO_PRO_API_KEY || "";

    // Use different endpoints based on API key availability (per CoinGecko docs)
    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else if (this.apiKey) {
      // Authenticated Pro endpoint for paid API access
      this.serverUrl = "https://mcp.pro-api.coingecko.com/sse";
      console.log(
        "Using CoinGecko Pro API endpoint (authenticated with API key)"
      );
    } else {
      // Public keyless endpoint for free tier
      this.serverUrl = "https://mcp.api.coingecko.com/sse";
      console.log(
        "Using CoinGecko Public API endpoint (keyless - shared rate limits)"
      );
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      // Create headers for API key authentication
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
        headers["X-CG-API-KEY"] = this.apiKey;
      }

      // Create SSE transport to CoinGecko's MCP server with authentication
      this.transport = new SSEClientTransport(
        new URL(this.serverUrl)
      );

      // Create MCP client
      this.client = new Client(
        {
          name: "coingecko-proxy",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Connect to the remote server
      await this.client.connect(this.transport);
      this.isConnected = true;

      const accessType = this.apiKey
        ? "Pro API (higher rate limits, full access)"
        : "Public API (shared rate limits, basic access)";
      console.log(
        `✅ Connected to CoinGecko MCP server: ${this.serverUrl} - ${accessType}`
      );
    } catch (error) {
      console.error("❌ Failed to connect to CoinGecko MCP server:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      this.isConnected = false;
      console.log("Disconnected from CoinGecko MCP server");
    } catch (error) {
      console.error("Error disconnecting from CoinGecko MCP server:", error);
    }
  }

  async listTools() {
    if (!this.client || !this.isConnected) {
      throw new Error("Not connected to CoinGecko MCP server");
    }

    try {
      const response = await this.client.listTools();
      return response.tools;
    } catch (error) {
      console.error("Error listing tools from CoinGecko MCP:", error);
      throw error;
    }
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    if (!this.client || !this.isConnected) {
      throw new Error("Not connected to CoinGecko MCP server");
    }

    try {
      const response = await this.client.callTool({
        name,
        arguments: arguments_,
      });
      return response;
    } catch (error) {
      console.error(`Error calling tool ${name} on CoinGecko MCP:`, error);
      throw error;
    }
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let coinGeckoProxy: CoinGeckoMCPProxy | null = null;
let connectionPromise: Promise<CoinGeckoMCPProxy> | null = null;

export async function getCoinGeckoProxy(): Promise<CoinGeckoMCPProxy> {
  if (coinGeckoProxy && coinGeckoProxy.isClientConnected()) {
    return coinGeckoProxy;
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        if (coinGeckoProxy) {
          await coinGeckoProxy.disconnect();
        }
        coinGeckoProxy = new CoinGeckoMCPProxy(
          undefined, // Let constructor choose endpoint based on API key
          process.env.COINGECKO_PRO_API_KEY
        );
        await coinGeckoProxy.connect();
        return coinGeckoProxy;
      } catch (error) {
        connectionPromise = null;
        throw error;
      }
    })();
  }

  return connectionPromise;
}

export async function closeCoinGeckoProxy(): Promise<void> {
  connectionPromise = null;
  if (coinGeckoProxy) {
    await coinGeckoProxy.disconnect();
    coinGeckoProxy = null;
  }
}
