import {McpServer} from "@modelcontextprotocol/sdk/server/mcp";
import * as service from "./service";
import z from "zod";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp";
import { getCoinGeckoProxy, closeCoinGeckoProxy } from "./coingecko-proxy";

export async function createMcpServer() {
    const mcpServer = new McpServer({
        name: "Todo app with CoinGecko",
        version: "0.0.1",
    })

    mcpServer.tool(
        "list-todos",
        "List all the current todos",
        {},
        async (input, extra) => {
            const user = extra.authInfo?.extra?.sub as string;
            const todos = service.getTodos(user);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(todos),
                }]
            }
        }
    )

    mcpServer.tool(
        "add-todo",
        "Add a todo",
        {
            todo: z.string().describe("The content of the todo to be added")
        },
        async ({todo}, extra) => {
            const user = extra.authInfo?.extra?.sub as string;
            service.createTodo(user, todo);
            return {
                content: [{
                    type: "text",
                    text: `Added ${todo}`
                }]
            }
        }
    )

    mcpServer.tool(
        "delete-todo",
        "Delete a todo by index",
        {
            index: z.number().describe("The index of the todo to be removed (zero-indexed)")
        },
        async ({index}, extra) => {
            const user = extra.authInfo?.extra?.sub as string;
            service.deleteTodo(user, index);
            return {
                content: [{
                    type: "text",
                    text: `Removed todo at ${index}`
                }]
            }
        }
    )

    // Register CoinGecko tools dynamically
    try {
        const coinGeckoProxy = await getCoinGeckoProxy();
        const coinGeckoTools = await coinGeckoProxy.listTools();
        
        // Register each CoinGecko tool as a proxy
        for (const tool of coinGeckoTools) {
            // Convert JSON schema to Zod schema or use empty object
            const schema = tool.inputSchema?.properties ? 
                Object.fromEntries(
                    Object.entries(tool.inputSchema.properties).map(([key, prop]: [string, any]) => [
                        key, 
                        z.any().optional().describe(prop.description || '')
                    ])
                ) : {};

            mcpServer.tool(
                `coingecko-${tool.name}`,
                tool.description || `CoinGecko tool: ${tool.name}`,
                schema,
                async (input, extra) => {
                    try {
                        const result = await coinGeckoProxy.callTool(tool.name, input);
                        // Ensure the result conforms to expected format
                        return {
                            content: Array.isArray(result.content) ? result.content : [{
                                type: "text",
                                text: JSON.stringify(result)
                            }]
                        };
                    } catch (error) {
                        console.error(`Error calling CoinGecko tool ${tool.name}:`, error);
                        return {
                            content: [{
                                type: "text",
                                text: `Error calling CoinGecko tool: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
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
        sessionIdGenerator: undefined
    })

    await mcpServer.connect(transport);

    return {transport, mcpServer};
}