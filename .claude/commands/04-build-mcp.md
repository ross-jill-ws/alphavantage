# 04 - Build MCP Server

## Overview

Create `src/mcp.ts` - a Model Context Protocol (MCP) server that exposes the Alpha Vantage data retrieval functionality as MCP tools. The implementation should MIRROR the structure from the [bun-mcp-template](https://github.com/ross-jill-ws/bun-mcp-template/tree/main).

## Template Reference

The MCP server should follow the structure of the `bun-mcp-template` repository:
- Support both **stdio** and **SSE (Server-Sent Events)** transport modes
- Use `@modelcontextprotocol/sdk` for MCP implementation
- NO resources or prompts needed - **tools only**

## Transport Modes

### Stdio Mode (Default)
```bash
bun src/mcp.ts --stdio
```
Direct CLI communication for use with MCP clients.

### SSE Mode (HTTP)
```bash
bun src/mcp.ts --sse --port 3001
```
HTTP-based with Express, allowing:
- POST requests to `/messages` endpoint
- SSE streaming via `/sse`

## Tools to Implement

### 1. `get_stock_prices`

**Purpose:** Query stock price data from MongoDB for a given stock symbol.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbol` | string | Yes | Stock ticker symbol (e.g., "AAPL", "IBM", "MSFT") |
| `date` | string | No | Specific date in YYYYMMDD format. If omitted, returns the latest 100 prices. |

**Behavior:**
- Queries the `stock-{symbol}` collection in the `finance` database
- If `date` is provided: Returns the stock data for that specific date
- If `date` is omitted: Returns the latest 100 stock prices sorted by date descending

**Example Input:**
```json
{
  "symbol": "AAPL",
  "date": "20251223"
}
```

**Example Output (from sample-stocks.json):**
```json
{
  "symbol": "AAPL",
  "date": "2025-12-23",
  "open": 270.97,
  "high": 272.45,
  "low": 269.56,
  "close": 272.36,
  "volume": 29360026
}
```

**Output Schema:**
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

**Tool Definition:**
```typescript
{
  name: "get_stock_prices",
  description: "Query stock price data from MongoDB for a given stock symbol. Returns daily OHLCV (Open, High, Low, Close, Volume) data. If a specific date is provided, returns data for that date only. Otherwise, returns the latest 100 trading days sorted by date descending. Example response: {\"symbol\": \"AAPL\", \"date\": \"2025-12-23\", \"open\": 270.97, \"high\": 272.45, \"low\": 269.56, \"close\": 272.36, \"volume\": 29360026}",
  inputSchema: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "Stock ticker symbol (e.g., 'AAPL', 'IBM', 'MSFT', 'GOOGL')"
      },
      date: {
        type: "string",
        description: "Optional. Specific date in YYYYMMDD format (e.g., '20251223'). If omitted, returns the latest 100 prices."
      }
    },
    required: ["symbol"]
  }
}
```

---

### 2. `get_news`

**Purpose:** Query news articles from MongoDB within a date range, with optional keyword filtering.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `from` | string | Yes | Start date in YYYYMMDD format (e.g., "20251221") |
| `to` | string | Yes | End date in YYYYMMDD format (e.g., "20251222") |
| `keyword` | string | No | Optional keyword to filter news by title and summary (case-insensitive regex match) |

**Behavior:**
- Queries the `news` collection in the `finance` database
- Filters by `time_published` field using the date range (converted to `YYYYMMDDT0000` - `YYYYMMDDT2359` format)
- If `keyword` is provided: Additionally filters using MongoDB `$or` with `$regex` on both `title` and `summary` fields (case-insensitive)

**MongoDB Query Logic:**
```typescript
// Base filter
const filter: Record<string, any> = {
  time_published: {
    $gte: `${from}T0000`,
    $lte: `${to}T2359`
  }
};

// Add keyword filter if provided
if (keyword) {
  filter.$or = [
    { title: { $regex: keyword, $options: "i" } },
    { summary: { $regex: keyword, $options: "i" } }
  ];
}
```

**Example Input:**
```json
{
  "from": "20251221",
  "to": "20251222",
  "keyword": "trading"
}
```

**Example Output (from sample-news.json):**
```json
[
  {
    "title": "(MXI) Price Dynamics and Execution-Aware Positioning",
    "url": "https://news.stocktradersdaily.com/news_release/101/MXI_Price_Dynamics_and_Execution-Aware_Positioning_122225120005_1766379605.html",
    "time_published": "20251222T000000",
    "authors": ["Jeff and Andy"],
    "summary": "Ishares Global Materials Etf (NYSE: MXI) is currently showing neutral sentiment in the near and mid-term, with a positive long-term bias that could moderate. The stock is testing resistance with an exceptional 10.8:1 risk-reward short setup targeting 3.1% downside. Three distinct AI-generated trading strategies (Position Trading, Momentum Breakout, and Risk Hedging) are provided for different risk profiles.",
    "banner_image": "https://news.stocktradersdaily.com/media/691336_MXI_graph.jpg",
    "source": "Stock Traders Daily",
    "category_within_source": "General",
    "source_domain": "Stock Traders Daily",
    "topics": [
      { "topic": "financial_markets", "relevance_score": "0.910652" },
      { "topic": "economy_macro", "relevance_score": "0.617476" }
    ],
    "overall_sentiment_score": 0.045162,
    "overall_sentiment_label": "Neutral",
    "ticker_sentiment": [
      {
        "ticker": "MXI",
        "relevance_score": "1.000000",
        "ticker_sentiment_score": "0.035610",
        "ticker_sentiment_label": "Neutral"
      }
    ]
  }
]
```

**Output Schema:**
```typescript
interface NewsItem {
  title: string;                    // Article title
  url: string;                      // Article URL
  time_published: string;           // Publication time in YYYYMMDDTHHMMSS format
  authors: string[];                // List of author names
  summary: string;                  // Article summary
  banner_image: string | null;      // Banner image URL or null
  source: string;                   // News source name
  category_within_source: string;   // Category within the source
  source_domain: string;            // Source domain name
  topics: Topic[];                  // Related topics with relevance scores
  overall_sentiment_score: number;  // Sentiment score (-1 to 1)
  overall_sentiment_label: string;  // "Bearish" | "Somewhat-Bearish" | "Neutral" | "Somewhat_Bullish" | "Bullish"
  ticker_sentiment: TickerSentiment[]; // Sentiment per mentioned ticker
}

interface Topic {
  topic: string;
  relevance_score: string;
}

interface TickerSentiment {
  ticker: string;
  relevance_score: string;
  ticker_sentiment_score: string;
  ticker_sentiment_label: string;
}
```

**Sentiment Score Interpretation:**
- `x <= -0.35`: Bearish
- `-0.35 < x <= -0.15`: Somewhat-Bearish
- `-0.15 < x < 0.15`: Neutral
- `0.15 <= x < 0.35`: Somewhat_Bullish
- `x >= 0.35`: Bullish

**Tool Definition:**
```typescript
{
  name: "get_news",
  description: "Query financial news articles from MongoDB within a date range. Optionally filter by keyword in title or summary. Returns news with sentiment analysis, topics, and ticker sentiment data. Example response: {\"title\": \"(MXI) Price Dynamics and Execution-Aware Positioning\", \"time_published\": \"20251222T000000\", \"summary\": \"Ishares Global Materials Etf (NYSE: MXI) is currently showing neutral sentiment...\", \"overall_sentiment_score\": 0.045162, \"overall_sentiment_label\": \"Neutral\", \"ticker_sentiment\": [{\"ticker\": \"MXI\", \"ticker_sentiment_label\": \"Neutral\"}]}",
  inputSchema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Start date in YYYYMMDD format (e.g., '20251221')"
      },
      to: {
        type: "string",
        description: "End date in YYYYMMDD format (e.g., '20251222')"
      },
      keyword: {
        type: "string",
        description: "Optional keyword to filter news articles. Searches in both title and summary fields using case-insensitive matching."
      }
    },
    required: ["from", "to"]
  }
}
```

---

## Implementation Details

### File Structure
```
src/
├── mcp.ts           # MCP server implementation (NEW)
├── mongo.ts         # MongoDB utilities (existing)
├── business.ts      # Business logic (existing - for reference)
└── run-stocks.ts    # CLI implementation (existing - for reference)
```

### Dependencies
The following packages are needed (should already be installed):
- `@modelcontextprotocol/sdk` - MCP SDK
- `express` - For SSE transport
- `mongodb` - MongoDB driver

### Key Implementation Points

1. **Connection Management:**
   - Connect to MongoDB at server startup
   - Use the existing `connect()` and `findDocuments()` functions from `./mongo.ts`
   - Handle graceful shutdown on SIGINT

2. **Date Format Conversion:**
   - `get_stock_prices`: Convert YYYYMMDD → YYYY-MM-DD for MongoDB queries
   - `get_news`: Convert YYYYMMDD → YYYYMMDDT0000/T2359 for time_published queries

3. **Error Handling:**
   - Return descriptive error messages for invalid parameters
   - Handle MongoDB connection errors gracefully
   - Validate date formats before querying

4. **Tool Response Format:**
   - Return JSON stringified results for tool responses
   - Include count information where applicable (e.g., "Found X news articles")

### Command-Line Arguments
```
--stdio     Run in stdio mode (default)
--sse       Run in SSE/HTTP mode
--port      Port for SSE mode (default: 3001)
```

### Running the Server

```bash
# Stdio mode (for MCP clients)
bun src/mcp.ts --stdio

# SSE mode (for HTTP clients)
bun src/mcp.ts --sse --port 3001
```

### Testing

After implementation, test with:
```bash
# Test get_stock_prices
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "AAPL"}}, "id": 1}' | bun src/mcp.ts --stdio

# Test get_news
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_news", "arguments": {"from": "20251221", "to": "20251222"}}, "id": 2}' | bun src/mcp.ts --stdio
```

## References

- [bun-mcp-template](https://github.com/ross-jill-ws/bun-mcp-template) - Template repository to mirror
- Existing CLI: `src/run-stocks.ts` - Reference for query logic
- MongoDB utilities: `src/mongo.ts` - Reuse `connect()`, `disconnect()`, `findDocuments()`
- Business types: `src/business.ts` - `StockData`, `NewsItem` type definitions
