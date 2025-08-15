# CoinGecko MCP Watchlist Server

A secure crypto portfolio management MCP server with CoinGecko integration and Civic Auth protection - built for the CoinGecko MCP Hackathon.

## 🎯 Overview

This project demonstrates how to build a comprehensive crypto watchlist management system that:
- **Secures API keys** using Civic Auth OAuth2.0 to protect expensive CoinGecko Pro API access
- **Provides rich crypto data** through seamless CoinGecko API integration
- **Manages user portfolios** with watchlists, price tracking, and notes
- **Enables social features** with public/private watchlist sharing
- **Implements MCP protocol** for AI agent integration with Claude, Cursor, and other LLMs

## 🛡️ Why Civic Auth for API Protection?

Instead of exposing your valuable CoinGecko Pro API key directly to AI agents, this server acts as a secure proxy:
- **API Key Protection**: Your CoinGecko Pro API key stays server-side, never exposed to clients
- **User Authentication**: Civic Auth ensures only authorized users can access your API resources
- **Cost Control**: Prevent unauthorized usage that could exhaust your API quotas
- **Access Logging**: Track which users are making which API calls

## 🚀 Features

- **Watchlist Management**: Create, update, delete crypto watchlists
- **Real-time Prices**: Live market data integration via CoinGecko Pro API
- **Coin Discovery**: Search trending coins and market data
- **Portfolio Notes**: Add notes and target prices to tracked coins
- **Social Sharing**: Public/private watchlist visibility controls
- **Secure Access**: Civic Auth protects API resources

## Prerequisites

- Node.js 18+
- pnpm
- CoinGecko Pro API Key (for production usage)

## 🔧 Installation & Setup

1. **Install dependencies**:
```bash
pnpm install
```

2. **Configure Environment Variables**:
Create a `.env` file or set the following environment variables:
```bash
COINGECKO_PRO_API_KEY=your_actual_pro_api_key_here
COINGECKO_ENVIRONMENT=pro
```

3. **Update MCP Configuration**:
In your `mcp-servers.json`, configure the server:
```json
{
  "mcpServers": {
    "coingecko_mcp_watchlist": {
      "type": "stdio",
      "command": "npx",
      "args": ["@civic/hub-bridge"],
      "env": {
        "MCP_REMOTE_URL": "http://localhost:3000/mcp",
        "COINGECKO_PRO_API_KEY": "YOUR_PRO_API_KEY_HERE",
        "COINGECKO_ENVIRONMENT": "pro"
      }
    }
  }
}
```

## 🚀 Running the Server

```bash
pnpm dev
```

The server will start on http://localhost:3000

## 🧪 Testing

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test your server:

```bash
npx @modelcontextprotocol/inspector
```

Connect to `http://localhost:3000/mcp` using "Streamable HTTP" transport.

## 🔐 API Key Security

This server demonstrates a secure pattern for protecting valuable API keys:

- **Server-Side Storage**: Your CoinGecko Pro API key is stored securely on your server
- **Civic Auth Gateway**: All requests go through Civic Auth authentication first
- **Proxy Pattern**: AI agents connect to your secure server, not directly to CoinGecko
- **Usage Control**: You maintain full control over who can access your API quota

## 🏗️ Architecture

```
AI Agent (Claude/Cursor) → Civic Auth → Your MCP Server → CoinGecko Pro API
                              ↓
                         User Authentication
                              ↓
                         Protected API Access
```

## 📚 Available MCP Tools

- `create-watchlist` - Create new crypto watchlists
- `get-my-watchlists` - Retrieve user's watchlists
- `add-coin-to-watchlist` - Add cryptocurrencies to watchlists
- `get-watchlist-with-prices` - Get watchlist with live market data
- `search-coins` - Search for cryptocurrencies
- `get-trending-coins` - Get trending crypto data
- And more... (see source code for complete API)

## 🎖️ Built for CoinGecko MCP Hackathon

This project showcases:
- **Innovation**: Secure API key management pattern for AI agents
- **Usefulness**: Real-world crypto portfolio management needs
- **Integration**: Seamless CoinGecko Pro API integration with MCP protocol

---

**#BuildwithCoinGecko** | Built with ❤️ for the crypto community