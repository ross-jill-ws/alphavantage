# Alpha Vantage MCP Server

A Model Context Protocol (MCP) server that provides access to Alpha Vantage stock price and financial news data through MongoDB storage. This project demonstrates a systematic approach to building production-ready MCP servers.

## 📺 Video Tutorial

Watch the complete tutorial on YouTube:

[![Building MCP Servers with Bun](https://img.youtube.com/vi/Nmu5DLqAwPg/maxresdefault.jpg)](https://youtu.be/Nmu5DLqAwPg)

**[▶️ Building MCP Servers with Bun](https://youtu.be/Nmu5DLqAwPg)**

## 🎯 What This Project Does

This MCP server provides two powerful tools for querying financial data:

1. **`get_stock_prices`** - Query stock price data (OHLCV) with automatic API fetching when data is missing
2. **`get_news`** - Query financial news articles with sentiment analysis and keyword filtering

The server automatically pulls missing data from the Alpha Vantage API, stores it in MongoDB for fast future queries, and provides graceful error handling with helpful messages.

## 🏗️ Building an MCP Server: The Common Pattern

This project follows a systematic 6-step approach to building MCP servers. You can use this pattern for any MCP server project:

### Step 1: Research & Preparation
- Identify the data source or API you want to integrate
- Study the API documentation and data structures
- Plan your data storage strategy (MongoDB, SQLite, files, etc.)
- Define what tools your MCP server will expose

**In this project:**
- API: Alpha Vantage API for stocks and news
- Storage: MongoDB with separate collections per stock symbol
- Tools: `get_stock_prices` and `get_news`

### Step 2: Install Dependencies
- Set up your runtime environment (Bun, Node.js, etc.)
- Install required packages for MCP, database, and API access
- Configure environment variables

**Commands:**
```bash
bun init
bun add @modelcontextprotocol/sdk mongodb express zod yargs
```

### Step 3: Create Utility Functions
- Build database connection and CRUD operations
- Create reusable helper functions
- Implement proper error handling and type safety

**Files created:**
- `src/mongo.ts` - MongoDB utilities (connect, findDocuments, upsertDocument, etc.)

### Step 4: Implement Core Business Logic
- Create functions to interact with your data source/API
- Implement data fetching, parsing, and storage
- Handle rate limiting and API key rotation

**Files created:**
- `src/business.ts` - Alpha Vantage API integration (pullStock, pullNews, getKey)

### Step 5: Create CLI Tool
- Build a command-line interface for testing and manual operations
- Implement all major operations as CLI commands
- This helps validate your business logic before building the MCP server

**Files created:**
- `src/run-stocks.ts` - CLI tool using yargs

### Step 6: Build the MCP Server
- Use the [bun-mcp-template](https://github.com/ross-jill-ws/bun-mcp-template) as a starting point
- Implement tool handlers that leverage your business logic
- Add both stdio and SSE transport support
- Include comprehensive error handling

**Files created:**
- `src/mcp.ts` - MCP server implementation

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- MongoDB running (default: `mongodb://localhost:27017`)
- Alpha Vantage API key(s) (get free keys at https://www.alphavantage.co/support/#api-key)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd alphavantage

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env and add your MongoDB connection string
# Example: MONGODB_CONNECTION_STRING=mongodb://localhost:27017

# Set up API keys for auto-pull feature
cp .keylist.example .keylist
# Then add your Alpha Vantage API keys to .keylist (one per line)
```

**Getting API Keys:**

You can manually get API keys from [Alpha Vantage](https://www.alphavantage.co/support/#api-key), or use the automated slash command:

```bash
# Using Claude Code with the /00-get-keys slash command
# This will automatically fetch multiple API keys and add them to .keylist
/00-get-keys 5   # Gets 5 API keys
```

See [SETUP-KEYLIST.md](SETUP-KEYLIST.md) for detailed `.keylist` setup instructions.

## 🧪 Testing

### Run All Tests

```bash
# Test MongoDB utilities
bun test src/mongo.test.ts

# Test business logic
bun test src/business.test.ts

# Verify MCP implementation
bun run verify
# or
bun verify-mcp.ts
```

### Test Specific Features

```bash
# Test auto-pull feature
bun test-auto-pull.ts

# Test .keylist path resolution
bun test-keylist-path.ts

# Test SSE transport mode
bun test-sse.ts
```

## 🖥️ Using the CLI Tool

The CLI provides direct access to all functionality for testing and manual operations.

### Pull Data from API

```bash
# Pull stock data for a symbol
bun src/run-stocks.ts --pull-stock AAPL

# Pull news for a date range (YYYYMMDD-YYYYMMDD)
bun src/run-stocks.ts --pull-news 20251220-20251222
```

### Query Data from MongoDB

```bash
# Get latest 100 stock prices for a symbol
bun src/run-stocks.ts --symbol AAPL

# Get stock price for a specific date
bun src/run-stocks.ts --symbol AAPL --date 20251223

# Query news articles within a date range
bun src/run-stocks.ts --news --from 20251220 --to 20251222
```

### CLI Help

```bash
# Show all available commands and options
bun src/run-stocks.ts --help
```

### CLI Examples

```bash
# Example 1: Pull and query Apple stock data
bun src/run-stocks.ts --pull-stock AAPL
bun src/run-stocks.ts --symbol AAPL

# Example 2: Query specific date
bun src/run-stocks.ts --symbol MSFT --date 20251223

# Example 3: Pull and search news
bun src/run-stocks.ts --pull-news 20251220-20251222
bun src/run-stocks.ts --news --from 20251220 --to 20251222
```

## 🔌 Installing the MCP Server

The MCP server can be installed in various MCP clients like Cursor, Claude Desktop, and Claude Code CLI.

### Option 1: Install in Cursor

Add this configuration to your `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "alphavantage": {
      "command": "bun",
      "args": [
        "/Users/rossz/workspace/tutorials/labs/alphavantage/src/mcp.ts"
      ],
      "env": {
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}
```

**Note:** Update the path to match your actual project location.

### Option 2: Install in Claude Desktop

Add this configuration to your Claude Desktop MCP settings file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "alphavantage": {
      "command": "bun",
      "args": [
        "/Users/rossz/workspace/tutorials/labs/alphavantage/src/mcp.ts",
        "--stdio"
      ],
      "env": {
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}
```

### Option 3: Install in Claude Code CLI

Using the `claude mcp add` command:

```bash
claude mcp add alphavantage bun /Users/rossz/workspace/tutorials/labs/alphavantage/src/mcp.ts
```

This will automatically configure the MCP server in Claude Code. You can verify it's installed:

```bash
# List all MCP servers
claude mcp list

# Check server status
claude mcp status alphavantage
```

### Configuring Environment Variables

After installation, you may need to set environment variables:

**For Cursor/Claude Desktop:** Add to the `env` object in the JSON config:
```json
"env": {
  "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017"
}
```

**For Claude Code CLI:** Environment variables are automatically loaded from your project's `.env` file.

## 🛠️ Running the MCP Server Directly

You can also run the MCP server directly for testing:

### Stdio Mode (for MCP clients)

```bash
bun src/mcp.ts --stdio
```

### SSE Mode (for HTTP clients)

```bash
# Default port 3001
bun src/mcp.ts --sse

# Custom port
bun src/mcp.ts --sse --port 8080
```

### Test MCP Server Manually

```bash
# List available tools
echo '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' | bun src/mcp.ts --stdio 2>/dev/null

# Get stock prices for AAPL
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "AAPL"}}, "id": 2}' | bun src/mcp.ts --stdio 2>/dev/null

# Get news articles
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_news", "arguments": {"from": "20251220", "to": "20251222"}}, "id": 3}' | bun src/mcp.ts --stdio 2>/dev/null
```

## 📚 MCP Tools Reference

### Tool 1: `get_stock_prices`

Query stock price data with automatic API fetching.

**Parameters:**
- `symbol` (string, required) - Stock ticker symbol (e.g., "AAPL", "MSFT", "GOOGL")
- `date` (string, optional) - Specific date in YYYYMMDD format (e.g., "20251223")

**Behavior:**
- Queries MongoDB first
- If not found, automatically pulls from Alpha Vantage API
- Returns specific date data or latest 100 prices
- Indicates if data was "freshly pulled from API"

**Example:**
```json
{
  "name": "get_stock_prices",
  "arguments": {
    "symbol": "AAPL",
    "date": "20251223"
  }
}
```

### Tool 2: `get_news`

Query financial news articles with sentiment analysis.

**Parameters:**
- `from` (string, required) - Start date in YYYYMMDD format
- `to` (string, required) - End date in YYYYMMDD format
- `keyword` (string, optional) - Filter by keyword in title/summary

**Behavior:**
- Queries news collection in MongoDB
- Filters by date range and optional keyword
- Returns articles with sentiment scores and ticker sentiment

**Example:**
```json
{
  "name": "get_news",
  "arguments": {
    "from": "20251220",
    "to": "20251222",
    "keyword": "market"
  }
}
```

## 🎯 Key Features

### Auto-Pull Feature
The MCP server automatically fetches missing stock data from the Alpha Vantage API when queried. This provides a seamless experience - users can query any stock symbol without manually pulling data first.

**How it works:**
1. User queries a stock symbol
2. Server checks MongoDB
3. If not found, automatically calls Alpha Vantage API
4. Stores data in MongoDB
5. Returns the data with "(freshly pulled from API)" indicator

### Intelligent Error Handling
- Missing `.keylist` file: Provides setup instructions and manual pull alternative
- Invalid API keys: Clear error messages with documentation links
- Rate limit errors: Helpful guidance on API limits
- All errors include actionable next steps

### Path Resolution
The `.keylist` file is located using absolute path resolution based on the source file location. This ensures the server works regardless of the working directory.

### Rate Limiting
- Automatic 5-second delay after API calls
- Round-robin key rotation from `.keylist` file
- Respects Alpha Vantage free tier limits (5 calls/minute, 500 calls/day)

## 📁 Project Structure

```
alphavantage/
├── .claude/
│   └── commands/          # Slash commands for development workflow
│       ├── 00-get-keys.md
│       ├── 01-mongo-crud.md
│       ├── 02-core-business.md
│       ├── 03-run-cli.md
│       └── 04-build-mcp.md
├── src/
│   ├── mongo.ts           # MongoDB CRUD utilities
│   ├── business.ts        # Alpha Vantage API integration
│   ├── run-stocks.ts      # CLI tool
│   └── mcp.ts             # MCP server implementation
├── .env                   # Environment variables
├── .keylist               # Alpha Vantage API keys (one per line)
├── package.json
├── README.md
├── MCP-SERVER-README.md   # Detailed MCP server documentation
└── SETUP-KEYLIST.md       # .keylist setup guide
```

## 🔧 Configuration

### Environment Variables

Rename `.env.example` to `.env` and configure your MongoDB connection:

```bash
cp .env.example .env
```

Then edit `.env`:

```bash
MONGODB_CONNECTION_STRING=mongodb://localhost:27017
```

### API Keys

Rename `.keylist.example` to `.keylist` and add your Alpha Vantage API keys:

```bash
cp .keylist.example .keylist
```

Then add your API keys to `.keylist` (one per line):

```
YOUR_API_KEY_1
YOUR_API_KEY_2
YOUR_API_KEY_3
```

**Automated Key Generation:**

Use the `/00-get-keys` slash command to automatically fetch multiple API keys:

```bash
/00-get-keys 5   # Fetches 5 API keys and appends them to .keylist
```

See [SETUP-KEYLIST.md](SETUP-KEYLIST.md) for detailed setup instructions.

## 📖 Additional Documentation

- [MCP-SERVER-README.md](MCP-SERVER-README.md) - Detailed MCP server documentation
- [SETUP-KEYLIST.md](SETUP-KEYLIST.md) - Complete .keylist setup guide
- [AUTO-PULL-FEATURE.md](AUTO-PULL-FEATURE.md) - Auto-pull feature documentation
- [ERROR-HANDLING-UPDATE.md](ERROR-HANDLING-UPDATE.md) - Error handling details
- [PATH-RESOLUTION-FIX.md](PATH-RESOLUTION-FIX.md) - Path resolution implementation

## 🤝 Contributing

This project follows a systematic development pattern that can be adapted for other MCP servers. Feel free to use it as a template!

## 📝 License

This project was created using `bun init` in bun v1.2.20. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## 🔗 Resources

- [MCP Template Repository](https://github.com/ross-jill-ws/bun-mcp-template)
- [Alpha Vantage API Documentation](https://www.alphavantage.co/documentation/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Bun Documentation](https://bun.sh/docs)
- [Video Tutorial](https://youtu.be/Nmu5DLqAwPg)

## 💡 Tips

1. **Start with the CLI** - Build and test your business logic with a CLI tool before creating the MCP server
2. **Use the template** - The [bun-mcp-template](https://github.com/ross-jill-ws/bun-mcp-template) provides a solid foundation
3. **Test thoroughly** - Create test scripts for each component (MongoDB, API, MCP tools)
4. **Document errors** - Provide helpful error messages with actionable guidance
5. **Handle edge cases** - Consider rate limits, missing data, network errors, etc.

## 🐛 Troubleshooting

### MCP Server Not Connecting

1. Verify MongoDB is running: `mongo --version` or check Docker container
2. Check `.env` file has correct `MONGODB_CONNECTION_STRING`
3. Ensure the path in MCP config matches your actual project location
4. Check MCP client logs for specific errors

### Auto-Pull Not Working

1. Verify `.keylist` file exists in project root
2. Check API keys are valid (test with CLI: `bun src/run-stocks.ts --pull-stock AAPL`)
3. Ensure you haven't hit rate limits (5 calls/minute, 500 calls/day)
4. Check server logs for specific error messages

### Path Resolution Issues

The `.keylist` file must be in the project root. If you get "file not found" errors, verify:
```bash
ls -la .keylist
```

The server uses absolute path resolution, so it should work from any directory.

---

Built with ❤️ using [Bun](https://bun.sh) and the [Model Context Protocol](https://modelcontextprotocol.io/)
