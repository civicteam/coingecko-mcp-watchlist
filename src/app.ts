import express from "express";
import * as service from "./service";
import { extractFromAuthHeader } from "./util";
import {createMcpServer} from "./mcp";
import { auth } from "@civic/auth-mcp"
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());
app.use(await auth());

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

app.post("/mcp", async (req, res) => {
  const { transport, mcpServer } = await createMcpServer();

  await transport.handleRequest(req, res, req.body);

  res.on('close', () => {
    transport.close();
    mcpServer.close();
  })
})

// Start the server
app.listen(3000, () => console.log("Todo app listening on port 3000"));