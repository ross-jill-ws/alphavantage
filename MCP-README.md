# Alpha Vantage MCP Server

An MCP (Model Context Protocol) server that provides tools for fetching stock prices and news from the Alpha Vantage API and storing them in MongoDB.

## Features

- **Two MCP Tools**:
  - `pull_stock_prices`: Fetch daily stock price data for a given symbol
  - `pull_news`: Fetch market news with sentiment analysis for a date range

- **Dual Transport Support**:
  - **stdio**: For CLI and Claude Desktop integration (default)
  - **SSE**: For HTTP-based clients

## Installation

Dependencies are already installed. If needed, run:

```bash
bun install
```

## Configuration

Ensure your `.env` file contains:

```
MONGODB_CONNECTION_STRING=localhost:27018
```

Also ensure you have valid Alpha Vantage API keys in `.keylist` file.

## Usage

### Running in stdio Mode (Default)

For use with Claude Desktop or CLI tools:

```bash
# Using bun directly
bun src/mcp.ts

# Or using the npm script
bun run mcp
```

### Running in SSE Mode

For HTTP-based clients:

```bash
# Default port (3001)
bun run mcp:sse

# Custom port
bun src/mcp.ts --sse --port 8080
```

### Building

To build a standalone executable:

```bash
bun run build:mcp
```

This creates `dist/mcp.js` which can be run with:

```bash
node dist/mcp.js
# or
./dist/mcp.js
```

## Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "alphavantage": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/alphavantage/src/mcp.ts"],
      "env": {
        "MONGODB_CONNECTION_STRING": "localhost:27018"
      }
    }
  }
}
```

Replace `/absolute/path/to/alphavantage` with the actual path to this project.

## Available Tools

### 1. pull_stock_prices

Fetches daily stock prices for a given symbol and stores in MongoDB.

**Parameters:**
- `symbol` (string, required): Stock ticker symbol (e.g., "AAPL", "GOOGL", "MSFT")

**Example:**
```json
{
  "name": "pull_stock_prices",
  "arguments": {
    "symbol": "AAPL"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully pulled 100 stock records for AAPL",
  "data": {
    "symbol": "AAPL",
    "records_pulled": 100,
    "collection": "stock-AAPL"
  }
}
```

**Data Storage:**
- Database: `finance`
- Collection: `stock-{SYMBOL}`
- Fields: `symbol`, `date`, `open`, `high`, `low`, `close`, `volume`

### 2. pull_news

Fetches market news with sentiment analysis for a date range.

**Parameters:**
- `start_date` (string, required): Start date in YYYYMMDD format (e.g., "20251221")
- `end_date` (string, required): End date in YYYYMMDD format (e.g., "20251222")

**Example:**
```json
{
  "name": "pull_news",
  "arguments": {
    "start_date": "20251221",
    "end_date": "20251222"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully pulled 50 news articles",
  "data": {
    "start_date": "20251221",
    "end_date": "20251222",
    "articles_pulled": 50
  }
}
```

**Data Storage:**
- Database: `finance`
- Collection: `news`
- Fields: `title`, `url`, `time_published`, `authors`, `summary`, `source`, `overall_sentiment_score`, `overall_sentiment_label`, `ticker_sentiment`, etc.

## Testing

A test script is provided to verify the MCP server:

```bash
bun test-mcp.ts
```

This will:
1. Start the MCP server in stdio mode
2. Send an initialize request
3. Request the list of available tools
4. Verify the server responds correctly

## Rate Limiting

- Each tool call consumes 1 API call from your Alpha Vantage quota
- Free tier: 25 API calls per day
- A 5-second delay is applied after each API call to respect rate limits

## Error Handling

All errors are returned in the following format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

## Architecture

The MCP server consists of:

1. **src/tool-definitions.ts**: Tool schemas and metadata
2. **src/mcp.ts**: Main MCP server implementation
   - Handles stdio and SSE transports
   - Manages MongoDB connections
   - Implements tool call handlers
   - Provides graceful shutdown

Dependencies:
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `express`: For SSE transport
- `mongodb`: Database connection (via src/mongo.ts)
- Business logic (via src/business.ts)

## Files Created

- `src/tool-definitions.ts`: Tool definitions with detailed descriptions
- `src/mcp.ts`: MCP server implementation
- `dist/mcp.js`: Built executable (after running `bun run build:mcp`)
- `test-mcp.ts`: Test script for verification

## Next Steps

1. Configure Claude Desktop to use this MCP server
2. Test the tools through Claude Desktop interface
3. Use the tools to build stock analysis and news sentiment applications

## Troubleshooting

**MongoDB Connection Issues:**
- Ensure MongoDB is running on the port specified in `.env`
- Check that `MONGODB_CONNECTION_STRING` is set correctly

**API Rate Limit:**
- Free tier allows 25 calls/day
- Consider upgrading to a paid plan for higher limits

**Missing API Keys:**
- Ensure `.keylist` file exists with valid Alpha Vantage API keys
- Format: One key per line
