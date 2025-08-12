import express from "express";
import * as service from "./service";
import { extractFromAuthHeader } from "./util";
import {createMcpServer} from "./mcp";
import { auth } from "@civic/auth-mcp"
import cors from "cors";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
// Ensure correct protocol/host are detected behind proxies like ngrok so discovery advertises https
app.set('trust proxy', 1);
// Debug /token exchange: logs request and response for troubleshooting 401s (dev only)
app.use((req, res, next) => {
  if (req.path === '/token') {
    const start = Date.now();
    const originalSend = res.send.bind(res);
    let responseBody: unknown;
    // capture body sent by the handler
    res.send = (body: unknown) => {
      responseBody = body;
      return originalSend(body as any);
    };
    res.on('finish', () => {
      const ms = Date.now() - start;
      try {
        // Avoid dumping secrets in logs in production
        console.log('[TOKEN]', req.method, req.originalUrl, res.statusCode, `${ms}ms`);
        console.log('[TOKEN][req.headers]', JSON.stringify({
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'x-forwarded-proto': req.headers['x-forwarded-proto'],
        }));
        console.log('[TOKEN][req.body]', JSON.stringify(req.body));
        console.log('[TOKEN][res.body]', typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody));
      } catch {}
    });
  }
  next();
});

// MCP Server Discovery - must be before auth middleware for public access
app.get("/.well-known/mcp", (_req, res) => {
  res.status(200).json({
    mcpServers: {
      "todo-app": {
        command: "node",
        args: ["--version"], // dummy, not used for HTTP
        transport: {
          type: "http",
          url: "https://5f7654e008a4.ngrok-free.app/mcp"
        }
      }
    }
  });
});

console.log('EXTERNAL_BASE_URL', process.env.EXTERNAL_BASE_URL);
app.use(await auth({ issuerUrl: process.env.EXTERNAL_BASE_URL }))

// Protected MCP endpoint at /mcp (protected by Civic auth middleware)
app.post("/mcp", async (req, res) => {
  const { transport, mcpServer } = await createMcpServer();
  
  await transport.handleRequest(req, res, req.body);
  
  res.on('close', () => {
    transport.close();
    mcpServer.close();
  })
});

app.get("/mcp", async (req, res) => {
  // Return server capabilities for GET requests
  const { transport, mcpServer } = await createMcpServer();
  res.status(200).json({
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: "Todo app",
      version: "0.0.1"
    }
  });
  transport.close();
  mcpServer.close();
});

// MCP HTTP transport discovery at root
app.all("/", (req, res) => {
  // For any request to root, redirect to the protected /mcp endpoint
  res.redirect(307, "/mcp");
});

app.get("/todo", (req, res) => {
  const userId = extractFromAuthHeader(req);
  const todos = service.getTodos(userId);
  res.json(todos);
});

app.post("/todo", (req, res) => {
  const userId = extractFromAuthHeader(req);
  const todo = service.createTodo(userId, req.body.todo);
  res.status(201).json(todo);
});

app.delete("/todo/:index", (req, res) => {
  const userId = extractFromAuthHeader(req);
  const index = parseInt(req.params.index);
  const success = service.deleteTodo(userId, index);
  res.status(success ? 200 : 404).json({ success });
});

// Remove duplicate /mcp handlers - using root path instead

// Start the server
app.listen(3000, () => console.log("Todo app listening on port 3000"));