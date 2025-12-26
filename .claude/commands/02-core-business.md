---
model: sonnet
description: Create core business utility for Alpha Vantage API integration
argument-hint: (no arguments needed)
---

## Variables

None

## Instructions

Create a TypeScript utility module for Alpha Vantage API operations with round-robin API key rotation and MongoDB storage.

### File Structure

Create the following files:
```
src/
├── business.ts           # Main business utility module
└── business.test.ts      # Test script for all functions
```

### Dependencies

This module depends on `src/mongo.ts` created by the `/01-mongo-crud` command. Import the following functions:
```typescript
import { connect, disconnect, listDocuments } from "./mongo";
```

**IMPORTANT**: You must also add a new function `upsertDocument` to `src/mongo.ts` (see below).

### Required Addition to `src/mongo.ts`

Add the following function to `src/mongo.ts`:

**`upsertDocument<T = Document>(db: string, collection: string, filter: Record<string, any>, doc: T): Promise<boolean>`**
- Uses MongoDB's `replaceOne` with `upsert: true` option
- If a document matching the `filter` exists, it will be **replaced entirely** with `doc`
- If no document matches the `filter`, a new document will be **inserted**
- Returns: `true` if a document was inserted or replaced
- Implementation:
```typescript
export async function upsertDocument<T = Document>(
  db: string,
  collection: string,
  filter: Record<string, any>,
  doc: T
): Promise<boolean> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection(collection);

  const result = await col.replaceOne(filter, doc as any, { upsert: true });
  return result.acknowledged;
}
```

### Configuration Files

**`.keylist`** - Contains Alpha Vantage API keys, one per line:
```
0AV6C31J4EP9ROXP
PW93XDXYXRRM89K9
...
```

**Important:** The `.keylist` file must be located in the **project root** directory.

### API Specification for `src/business.ts`

#### Path Resolution (CRITICAL)

Add path resolution at the top of `src/business.ts` to correctly locate `.keylist` file regardless of working directory:

```typescript
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this source file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Project root is one level up from src/
const PROJECT_ROOT = path.resolve(__dirname, "..");
```

This ensures `.keylist` is always found at the project root, even when the code is executed from different directories.

#### Types

Define the following TypeScript interfaces:

```typescript
interface StockData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TickerSentiment {
  ticker: string;
  relevance_score: string;
  ticker_sentiment_score: string;
  ticker_sentiment_label: string;
}

interface Topic {
  topic: string;
  relevance_score: string;
}

interface NewsItem {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  banner_image: string | null;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Topic[];
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment: TickerSentiment[];
}
```

#### Key Management

**`getKey(): Promise<string>`**
- Reads API keys from `.keylist` file in project root (using `PROJECT_ROOT` constant)
- Implements **Round-Robin Rotation** to get the next key in sequence
- Maintains internal state to track the current key index
- After each key is returned, the index advances to the next key
- When the last key is reached, wraps around to the first key
- Filters out empty lines from the keylist
- Uses absolute path: `path.join(PROJECT_ROOT, ".keylist")`
- Throws error if `.keylist` file is not found or empty

**`waitAfterApiCall(): Promise<void>`**
- Waits for 5 seconds (5000ms) before returning
- Use this after completing a REST API call to respect rate limits
- Implementation: `await new Promise(resolve => setTimeout(resolve, 5000))`

#### Stock Data Operations

**`pullStock(symbol: string): Promise<number>`**
- Calls the Alpha Vantage TIME_SERIES_DAILY API endpoint
- API URL: `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`
- Gets API key using `getKey()` function
- Parses the JSON response and extracts the `"Time Series (Daily)"` object
- For **each date entry** in the time series, creates a separate document with the following structure:

```typescript
{
  symbol: string,      // The stock symbol (e.g., "AAPL")
  date: string,        // The date string (e.g., "2025-12-23")
  open: number,        // Parsed from "1. open"
  high: number,        // Parsed from "2. high"
  low: number,         // Parsed from "3. low"
  close: number,       // Parsed from "4. close"
  volume: number       // Parsed from "5. volume"
}
```

- Saves each document to the `stock-${symbol}` collection in the `finance` database
  - Example: For symbol "AAPL", use collection name `stock-AAPL`
- **UNIQUE KEY**: The `date` field is the unique key for each document
  - Use `upsertDocument()` with filter `{ date: "<date-value>" }` to insert or replace
  - If a document with the same `date` already exists, it will be **replaced entirely**
  - This ensures no duplicate entries for the same date
- Calls `waitAfterApiCall()` after the API request completes
- Returns: The number of documents upserted (inserted or replaced)
- Throws error if API call fails or response is invalid

**Alpha Vantage Stock API Response Structure:**
```json
{
  "Meta Data": {
    "1. Information": "Daily Prices (open, high, low, close) and Volumes",
    "2. Symbol": "AAPL",
    "3. Last Refreshed": "2025-12-23",
    "4. Output Size": "Compact",
    "5. Time Zone": "US/Eastern"
  },
  "Time Series (Daily)": {
    "2025-12-23": {
      "1. open": "270.9700",
      "2. high": "272.4500",
      "3. low": "269.5600",
      "4. close": "272.3600",
      "5. volume": "29360026"
    },
    "2025-12-22": {
      "1. open": "272.8600",
      "2. high": "273.8800",
      "3. low": "270.5050",
      "4. close": "270.9700",
      "5. volume": "36571827"
    }
  }
}
```

#### News Sentiment Operations

**`pullNews(time_from: string, time_to: string): Promise<number>`**
- Calls the Alpha Vantage NEWS_SENTIMENT API endpoint
- API URL: `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=1000&time_from=${time_from}&time_to=${time_to}`
- Parameters:
  - `time_from`: Start time in format `YYYYMMDDTHHMM` (e.g., `20251221T0000`)
  - `time_to`: End time in format `YYYYMMDDTHHMM` (e.g., `20251222T0000`)
- Gets API key using `getKey()` function
- Parses the JSON response and extracts the `feed` array
- For **each item** in the `feed` array, creates a document in MongoDB
- Saves each document to the `news` collection in the `finance` database
- **UNIQUE KEY**: The `time_published` field is the unique key for each document
  - Use `upsertDocument()` with filter `{ time_published: "<time_published-value>" }` to insert or replace
  - If a document with the same `time_published` already exists, it will be **replaced entirely**
  - This ensures no duplicate news entries for the same publication time
- Calls `waitAfterApiCall()` after the API request completes
- Returns: The number of documents upserted (inserted or replaced)
- Throws error if API call fails or response is invalid

**Alpha Vantage News API Response Structure:**
```json
{
  "items": "1000",
  "sentiment_score_definition": "x <= -0.35: Bearish; ...",
  "relevance_score_definition": "0 < x <= 1, with a higher score indicating higher relevance.",
  "feed": [
    {
      "title": "(MXI) Price Dynamics and Execution-Aware Positioning",
      "url": "https://news.stocktradersdaily.com/...",
      "time_published": "20251222T000000",
      "authors": ["Jeff and Andy"],
      "summary": "Ishares Global Materials Etf (NYSE: MXI) is currently showing...",
      "banner_image": "https://news.stocktradersdaily.com/media/691336_MXI_graph.jpg",
      "source": "Stock Traders Daily",
      "category_within_source": "General",
      "source_domain": "Stock Traders Daily",
      "topics": [
        {
          "topic": "financial_markets",
          "relevance_score": "0.910652"
        }
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
}
```

### Implementation Requirements

1. **Round-Robin Key Rotation**: Maintain a module-level variable to track the current key index
2. **Rate Limiting**: Always call `waitAfterApiCall()` after API requests
3. **Error Handling**: All functions should throw descriptive errors for:
   - Missing or empty `.keylist` file
   - Failed API requests
   - Invalid API responses (missing expected fields)
   - MongoDB operation failures
4. **Type Safety**: Export all functions and interfaces with proper TypeScript types
5. **Number Parsing**: Convert string values from API responses to numbers using `parseFloat()` or `parseInt()`
6. **MongoDB Connection**: Use `connect()` at the start and `disconnect()` at the end of operations
7. **Upsert Behavior (CRITICAL)**:
   - **Stock Data**: Use `upsertDocument()` with `{ date }` as filter - the `date` field must be unique per document
   - **News Data**: Use `upsertDocument()` with `{ time_published }` as filter - the `time_published` field must be unique per document
   - If a document with the same key already exists, it must be **completely replaced** (not merged)
   - This allows re-running the same API calls without creating duplicate documents

### Test Script Specification for `src/business.test.ts`

Use `bun test` framework with the following test structure:

```typescript
import { test, expect, beforeAll, afterAll, describe } from "bun:test";
```

#### Test Configuration
- Use real `.keylist` file for key rotation tests
- Use `finance` database for MongoDB operations
- Clean up test data in `afterAll` hook (remove test collections)
- Use `describe` blocks to group related tests

#### Test Cases

**Key Management Tests**
- `test("should read keys from .keylist file")` - Verify getKey() returns a valid key string
- `test("should rotate keys in round-robin fashion")` - Call getKey() multiple times and verify rotation
- `test("should wrap around to first key after last key")` - Verify wrap-around behavior

**Stock Data Tests**
- `test("should pull stock data for a symbol")` - Call pullStock("IBM") and verify it returns a count > 0
- `test("should save stock documents to MongoDB")` - Verify documents exist in `stock-IBM` collection
- `test("should parse stock data correctly")` - Verify a document has correct fields (symbol, date, open, high, low, close, volume)
- `test("should replace existing stock document on re-pull")` - Call pullStock twice for same symbol, verify document count stays the same (no duplicates) and date field is unique

**News Sentiment Tests**
- `test("should pull news data for a time range")` - Call pullNews with valid date range and verify count > 0
- `test("should save news documents to MongoDB")` - Verify documents exist in `news` collection
- `test("should parse news data correctly")` - Verify a document has correct fields (title, url, time_published, etc.)
- `test("should replace existing news document on re-pull")` - Call pullNews twice for same time range, verify document count stays the same (no duplicates) and time_published field is unique

**Note**: Tests involving actual API calls should be marked with a longer timeout (e.g., 30 seconds) to account for network latency and the 5-second wait after each call.

### Example Usage Pattern

```typescript
import { connect, disconnect } from "./mongo";
import { getKey, pullStock, pullNews } from "./business";

// Connect to MongoDB
const client = await connect();

try {
  // Pull stock data for Apple
  const stockCount = await pullStock("AAPL");
  console.log(`Inserted ${stockCount} stock records for AAPL`);

  // Pull news for a date range
  const newsCount = await pullNews("20251221T0000", "20251222T0000");
  console.log(`Inserted ${newsCount} news articles`);

} finally {
  await disconnect(client);
}
```

### Implementation Steps

1. **Add `upsertDocument` function to `src/mongo.ts`** - Required for upsert operations
2. Create `src/business.ts` with all functions following the specification
3. Implement key rotation with module-level state tracking
4. Implement HTTP requests using native `fetch()` API
5. Parse API responses and convert to MongoDB documents
6. Use `upsertDocument()` with unique key filters:
   - Stock: `{ date }` filter
   - News: `{ time_published }` filter
7. Implement `src/business.test.ts` with comprehensive test coverage
8. Run tests with `bun test src/business.test.ts` to verify all functions work correctly
9. Ensure all tests pass before completing

### Important Notes

- The Alpha Vantage free tier has a rate limit of 25 API calls per day
- The 5-second wait between API calls helps distribute requests
- Round-robin rotation across multiple API keys helps maximize daily quota
- Stock collections are named dynamically based on symbol (e.g., `stock-AAPL`, `stock-MSFT`)
- News articles are all stored in a single `news` collection
- **Unique Keys & Upsert Behavior**:
  - `stock-<symbol>` collection: `date` is the unique key
  - `news` collection: `time_published` is the unique key
  - Re-running the same API call will **replace** existing documents (not create duplicates)
  - This ensures data integrity and allows for safe re-fetching of data
