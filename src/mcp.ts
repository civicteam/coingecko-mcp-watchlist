import {McpServer} from "@modelcontextprotocol/sdk/server/mcp";
import * as service from "./service";
import z from "zod";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp";

export async function createMcpServer() {
    const mcpServer = new McpServer({
        name: "Todo app",
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

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
    })

    await mcpServer.connect(transport);

    return {transport, mcpServer};
}