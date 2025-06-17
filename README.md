# Secure MCP Server Demo

A practical example of building a secure MCP (Model Context Protocol) server with Express, TypeScript, and Civic Auth.

## Overview

This repository demonstrates how to:
- Create an MCP server that exposes your existing APIs to LLMs
- Secure it with OAuth2.0 authentication using [@civic/auth-mcp](https://www.npmjs.com/package/@civic/auth-mcp)
- Integrate it seamlessly with your Express backend

See the guide at https://docs.civic.com/guides/add-auth-to-mcp

## Prerequisites

- Node.js 18+
- pnpm

## Installation

```bash
pnpm install
```

## Running the Server

```bash
pnpm dev
```

The server will start on http://localhost:3000

## Testing

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test your server:

```bash
npx @modelcontextprotocol/inspector
```

Connect to `http://localhost:3000/mcp` using "Streamable HTTP" transport.