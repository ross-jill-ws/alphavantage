# Auto-Pull Feature Enhancement

## Overview

The `get_stock_prices` MCP tool has been enhanced with an **auto-pull feature** that automatically fetches stock data from the Alpha Vantage API when it's not found in MongoDB.

## What Changed

### Before
```
User queries MSFT → Not in MongoDB → Returns "No data found"
```

### After
```
User queries MSFT → Not in MongoDB → Auto-pulls from API → Saves to MongoDB → Returns data
```

## Implementation Details

### Code Changes

**File:** `src/mcp.ts`

1. **Added import:**
```typescript
import { pullStock } from "./business";
```

2. **Enhanced `processGetStockPrices` method:**
```typescript
private async processGetStockPrices(symbol: string, date?: string): Promise<any> {
  const collectionName = `stock-${symbol}`;

  // Try to find in MongoDB
  let docs = await findDocuments<StockData>(...);

  // If not found, pull from API
  if (docs.length === 0) {
    console.error(`Stock data not found for ${symbol}, pulling from Alpha Vantage API...`);
    const count = await pullStock(symbol);
    console.error(`Pulled ${count} records for ${symbol}`);

    // Query again after pulling
    docs = await findDocuments<StockData>(...);
  }

  // Return results with appropriate message
  return {
    message: docs.length > 0
      ? `Stock data for ${symbol} (freshly pulled from API)`
      : `No stock data found for ${symbol} (even after pulling from API)`,
    data: docs
  };
}
```

3. **Updated tool description:**
```typescript
{
  name: "get_stock_prices",
  description: "Query stock price data from MongoDB for a given stock symbol.
                Returns daily OHLCV data. If the data is not found in MongoDB,
                it will automatically pull it from the Alpha Vantage API first. ..."
}
```

## User Benefits

### 1. Seamless Experience
Users can query any valid stock symbol without needing to manually pull data first:

```json
// No need to check if data exists or call pull_stock separately
{"name": "get_stock_prices", "arguments": {"symbol": "TSLA"}}
// → Automatically pulls if needed and returns data
```

### 2. Clear Feedback
The response message indicates whether data was freshly pulled:

```json
{
  "message": "Stock data for MSFT on 2025-12-23 (freshly pulled from API)",
  "data": { ... }
}
```

vs.

```json
{
  "message": "Stock data for AAPL on 2025-12-23",
  "data": { ... }
}
```

### 3. Intelligent Caching
Once pulled, data is stored in MongoDB and won't be re-fetched on subsequent queries.

## Technical Considerations

### Rate Limiting
The feature respects Alpha Vantage API rate limits:
- Uses the existing `pullStock()` function which includes a 5-second delay
- Keys are rotated from `.keylist` file in round-robin fashion

### Error Handling
If the API call fails or returns no data:
```json
{
  "message": "No stock data found for INVALID (even after pulling from API)",
  "data": null
}
```

### Performance Impact
- **First query:** Slower due to API call (~5-10 seconds including rate limit delay)
- **Subsequent queries:** Fast (direct MongoDB query)

### Logging
Server logs show when auto-pull is triggered:
```
Stock data not found for MSFT, pulling from Alpha Vantage API...
Pulled 100 records for MSFT
```

## Use Cases

### 1. On-Demand Data Fetching
Query any stock symbol without pre-loading:
```bash
# Works immediately, even if never queried before
get_stock_prices(symbol="NVDA")
```

### 2. Historical Data Queries
Request specific dates that may not be in the database yet:
```bash
get_stock_prices(symbol="GOOG", date="20251220")
# Auto-pulls if GOOG collection doesn't exist
```

### 3. Data Exploration
Try different stock symbols without manual data management:
```bash
get_stock_prices(symbol="AMD")
get_stock_prices(symbol="INTC")
get_stock_prices(symbol="TSM")
# Each auto-pulls if needed
```

## Testing

### Test Setup
```bash
bun test-auto-pull.ts
```

This script:
1. Removes MSFT collection if it exists
2. Verifies MSFT is not in MongoDB
3. Provides instructions for testing the auto-pull

### Manual Test
```bash
# Remove a stock collection
bun src/run-stocks.ts --symbol MSFT
# → Should show "No stock data found"

# Query via MCP (will auto-pull)
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "MSFT"}}, "id": 1}' | bun src/mcp.ts --stdio

# Query again (will use cached data)
bun src/run-stocks.ts --symbol MSFT
# → Should show MSFT data
```

## Comparison with CLI

### CLI Approach (Manual)
```bash
# Step 1: Pull data
bun src/run-stocks.ts --pull-stock MSFT

# Step 2: Query data
bun src/run-stocks.ts --symbol MSFT
```

### MCP Approach (Automatic)
```bash
# Single step - auto-pulls if needed
get_stock_prices(symbol="MSFT")
```

## Future Enhancements

Potential improvements:
1. **Configurable auto-pull:** Allow disabling via parameter
2. **Background refresh:** Auto-update stale data
3. **Partial pulls:** Pull only specific date ranges
4. **Cache invalidation:** Refresh data older than X days

## API Reference

### Updated Tool Signature

```typescript
get_stock_prices(
  symbol: string,    // Required: Stock ticker (e.g., "AAPL")
  date?: string      // Optional: Date in YYYYMMDD format
): {
  message: string,   // Includes "(freshly pulled from API)" if auto-pulled
  data: StockData | StockData[] | null
}
```

### Response Messages

| Scenario | Message |
|----------|---------|
| Found in MongoDB | `"Stock data for {symbol} on {date}"` |
| Auto-pulled successfully | `"Stock data for {symbol} on {date} (freshly pulled from API)"` |
| Not found after auto-pull | `"No stock data found for {symbol} (even after pulling from API)"` |

## Requirements

- `.keylist` file with valid Alpha Vantage API keys
- MongoDB connection
- Internet connectivity for API calls

## Backwards Compatibility

✅ Fully backwards compatible:
- Existing queries work exactly the same
- Only adds functionality, doesn't change existing behavior
- Response format unchanged (only message text enhanced)

## Summary

The auto-pull feature makes the MCP server more intelligent and user-friendly by:
- ✅ Eliminating manual data fetching steps
- ✅ Providing clear feedback when data is pulled
- ✅ Maintaining fast performance for cached data
- ✅ Respecting API rate limits
- ✅ Remaining fully backwards compatible

This enhancement transforms the MCP server from a passive query tool into an active data management system.
