# Alpha Vantage MCP Server

A Model Context Protocol (MCP) server that provides access to Alpha Vantage stock price and financial news data stored in MongoDB.

## Overview

This MCP server exposes two tools for querying financial data:
- `get_stock_prices` - Query stock price data (OHLCV) from MongoDB
- `get_news` - Query financial news articles with sentiment analysis from MongoDB

## Installation

Dependencies are already installed. The server requires:
- `@modelcontextprotocol/sdk` - MCP SDK
- `express` - For SSE transport mode
- `mongodb` - MongoDB driver
- `zod` - Schema validation

## Running the Server

The MCP server supports two transport modes:

### Stdio Mode (Default)

For use with MCP clients that communicate via standard input/output:

```bash
bun src/mcp.ts --stdio
```

### SSE Mode (HTTP)

For HTTP-based communication with Server-Sent Events:

```bash
bun src/mcp.ts --sse --port 3001
```

Or use a custom port:

```bash
bun src/mcp.ts --sse --port 8080
```

## Tools

### 1. get_stock_prices

Query stock price data from MongoDB for a given stock symbol. **Automatically pulls data from Alpha Vantage API if not found.**

**Parameters:**
- `symbol` (string, required) - Stock ticker symbol (e.g., "AAPL", "IBM", "MSFT", "GOOGL")
- `date` (string, optional) - Specific date in YYYYMMDD format (e.g., "20251223")

**Behavior:**
- First queries MongoDB for the requested stock data
- **If not found:** Automatically calls Alpha Vantage API to pull the data, then queries again
- If `date` is provided: Returns stock data for that specific date
- If `date` is omitted: Returns the latest 100 stock prices sorted by date descending
- Response message indicates if data was "freshly pulled from API"

**Auto-Pull Feature:**
This tool intelligently handles missing data by automatically fetching it from the Alpha Vantage API. This means you can query any valid stock symbol without having to manually pull the data first. The tool will:
1. Check if the data exists in MongoDB
2. If not found, pull from Alpha Vantage API (respects rate limits with 5-second delay)
3. Query MongoDB again and return the freshly pulled data

**Example Request (stdio):**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_stock_prices",
    "arguments": {
      "symbol": "AAPL",
      "date": "20251223"
    }
  },
  "id": 1
}
```

**Example Response (data already in MongoDB):**
```json
{
  "message": "Stock data for AAPL on 2025-12-23",
  "data": {
    "symbol": "AAPL",
    "date": "2025-12-23",
    "open": 270.84,
    "high": 272.5,
    "low": 269.56,
    "close": 272.36,
    "volume": 29641999
  }
}
```

**Example Response (auto-pulled from API):**
```json
{
  "message": "Stock data for MSFT on 2025-12-23 (freshly pulled from API)",
  "data": {
    "symbol": "MSFT",
    "date": "2025-12-23",
    "open": 442.91,
    "high": 445.67,
    "low": 441.23,
    "close": 444.85,
    "volume": 18234567
  }
}
```

### 2. get_news

Query financial news articles from MongoDB within a date range, with optional keyword filtering.

**Parameters:**
- `from` (string, required) - Start date in YYYYMMDD format (e.g., "20251221")
- `to` (string, required) - End date in YYYYMMDD format (e.g., "20251222")
- `keyword` (string, optional) - Keyword to filter news by title and summary (case-insensitive)

**Behavior:**
- Queries the `news` collection in the `finance` database
- Filters by `time_published` field using the date range
- If `keyword` is provided: Additionally filters using case-insensitive regex on both `title` and `summary` fields

**Example Request (stdio):**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_news",
    "arguments": {
      "from": "20251223",
      "to": "20251223",
      "keyword": "market"
    }
  },
  "id": 2
}
```

**Example Response:**
```json
{
  "message": "Found 5 news articles between 20251223 and 20251223 matching keyword \"market\"",
  "count": 5,
  "data": [
    {
      "title": "Exxon Mobil Stock (XOM) After Hours Today: Price Action, Top News, and What to Watch Before Markets Open Dec. 24, 2025",
      "url": "https://...",
      "time_published": "20251223T234114",
      "summary": "...",
      "overall_sentiment_score": 0.045162,
      "overall_sentiment_label": "Neutral",
      "ticker_sentiment": [...]
    }
  ]
}
```

## Testing

### Verify Implementation

Run the verification script to test underlying functionality:

```bash
bun verify-mcp.ts
# or
bun run verify
```

This will test:
- MongoDB connection
- Stock price queries
- News queries
- Date formatting
- Keyword filtering

### Test SSE Mode

Run the SSE mode test to verify the HTTP transport works correctly:

```bash
bun test-sse.ts
```

This verifies:
- SSE server starts correctly
- SSE endpoint accepts connections
- No "stream is not readable" errors
- Proper headers are set (text/event-stream)

### Manual Testing with stdio

You can test the MCP server manually using echo and pipes:

```bash
# List available tools
echo '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' | bun src/mcp.ts --stdio 2>/dev/null

# Get AAPL stock prices
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "AAPL", "date": "20251223"}}, "id": 2}' | bun src/mcp.ts --stdio 2>/dev/null

# Get news articles
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_news", "arguments": {"from": "20251223", "to": "20251223"}}, "id": 3}' | bun src/mcp.ts --stdio 2>/dev/null
```

## Environment Variables

The server requires the following environment variables:

**Required:**
- `MONGODB_CONNECTION_STRING` - MongoDB connection string

**For Auto-Pull Feature (Optional):**
- A `.keylist` file in the project root containing Alpha Vantage API keys (one per line)

The `.keylist` file is used for the auto-pull feature. Keys are rotated in round-robin fashion.

**📖 See [SETUP-KEYLIST.md](SETUP-KEYLIST.md) for detailed setup instructions.**

Example `.env` file:
```bash
MONGODB_CONNECTION_STRING=mongodb://localhost:27017
```

Example `.keylist` file:
```
YOUR_ALPHA_VANTAGE_API_KEY_1
YOUR_ALPHA_VANTAGE_API_KEY_2
```

**Note:**
- The auto-pull feature respects Alpha Vantage API rate limits by waiting 5 seconds after each API call
- If `.keylist` is not found, the server will still work for querying existing data, but auto-pull will fail with a helpful error message
- You can manually pull data using: `bun src/run-stocks.ts --pull-stock SYMBOL`

## Data Schema

### StockData
```typescript
interface StockData {
  symbol: string;      // Stock ticker symbol
  date: string;        // Date in YYYY-MM-DD format
  open: number;        // Opening price
  high: number;        // Highest price of the day
  low: number;         // Lowest price of the day
  close: number;       // Closing price
  volume: number;      // Trading volume
}
```

### NewsItem
```typescript
interface NewsItem {
  title: string;
  url: string;
  time_published: string;           // YYYYMMDDTHHMMSS format
  authors: string[];
  summary: string;
  banner_image: string | null;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Topic[];
  overall_sentiment_score: number;  // -1 to 1
  overall_sentiment_label: string;  // "Bearish" | "Neutral" | "Bullish" etc.
  ticker_sentiment: TickerSentiment[];
}
```

## Architecture

The MCP server is implemented following the [bun-mcp-template](https://github.com/ross-jill-ws/bun-mcp-template) structure:

- **Transport Support**: Both stdio (for CLI) and SSE (for HTTP) modes
- **Tool-Only**: No resources or prompts - focused on data query tools
- **MongoDB Integration**: Reuses existing `mongo.ts` utilities
- **Type Safety**: Fully typed with TypeScript using business types

## Error Handling

The server includes comprehensive error handling:
- Invalid date formats are rejected with descriptive messages
- Missing MongoDB collections return empty results with informative messages
- Connection errors are caught and reported
- Graceful shutdown on SIGINT

## Database Collections

- `finance.stock-{SYMBOL}` - Stock price data (one collection per symbol)
- `finance.news` - Financial news articles with sentiment analysis

## Troubleshooting

### SSE Mode: "stream is not readable" Error

**Problem**: When running in SSE mode, you get an error "InternalServerError: stream is not readable"

**Solution**: This error occurs when Express middleware (like `express.json()`) consumes the request body stream before the SSE transport can read it.

**Fix Applied**: The server implementation does NOT use `express.json()` middleware. The SSE transport reads the raw request body directly.

```typescript
// ✓ Correct - No body parser middleware
const app = express();
app.get("/sse", ...);
app.post("/messages", ...);

// ✗ Wrong - express.json() consumes the stream
const app = express();
app.use(express.json()); // DON'T DO THIS
```

### TypeScript Deprecation Warnings

You may see deprecation warnings about `Server` and `SSEServerTransport` from the `@modelcontextprotocol/sdk`. These are warnings from the SDK itself and can be safely ignored. They don't affect functionality.
