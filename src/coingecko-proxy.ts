import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import EventSource from "eventsource";

export class CoinGeckoMCPProxy {
    private client: Client | null = null;
    private transport: SSEClientTransport | null = null;
    private isConnected = false;

    constructor(private serverUrl = "https://mcp.api.coingecko.com/sse") {}

    async connect(): Promise<void> {
        if (this.isConnected) return;

        try {
            // Create SSE transport to CoinGecko's MCP server
            this.transport = new SSEClientTransport(
                new URL(this.serverUrl),
                EventSource
            );

            // Create MCP client
            this.client = new Client({
                name: "coingecko-proxy",
                version: "1.0.0",
            }, {
                capabilities: {
                    tools: {}
                }
            });

            // Connect to the remote server
            await this.client.connect(this.transport);
            this.isConnected = true;
            
            console.log("Connected to CoinGecko MCP server");
        } catch (error) {
            console.error("Failed to connect to CoinGecko MCP server:", error);
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
                arguments: arguments_
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
                coinGeckoProxy = new CoinGeckoMCPProxy();
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
