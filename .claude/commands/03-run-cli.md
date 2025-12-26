---
model: sonnet
description: Implement CLI tool for stock and news data operations
argument-hint: (no arguments needed)
---

## Variables

None

## Instructions

Create a TypeScript CLI tool `run-stocks.ts` using yargs for argument parsing to interact with Alpha Vantage data stored in MongoDB.

### File Structure

Create the following file:
```
src/
└── run-stocks.ts         # CLI tool for stock and news operations
```

### Dependencies

This module depends on:
- `src/mongo.ts` - MongoDB CRUD operations (uses `connect`, `disconnect`, `findDocuments`)
- `src/business.ts` - Alpha Vantage API functions (`pullStock`, `pullNews`)

**Note**: The `findDocuments` function should already be available in `src/mongo.ts` from the `/01-mongo-crud` command.

### Install yargs

Before implementing, install yargs:
```bash
bun add yargs @types/yargs
```

### CLI Specification for `src/run-stocks.ts`

#### Command Structure

The CLI supports the following commands and options:

##### 1. Pull Stock Data from API
```bash
bun src/run-stocks.ts --pull-stock <symbol>
```
- Calls `pullStock(symbol)` from `src/business.ts`
- Fetches stock data from Alpha Vantage API and stores in MongoDB
- Outputs the number of records pulled
- Example: `bun src/run-stocks.ts --pull-stock AAPL`

##### 2. Pull News Data from API
```bash
bun src/run-stocks.ts --pull-news <date-range>
```
- `<date-range>` must be in format `YYYYMMDD-YYYYMMDD`
- Converts to API format:
  - `from_time`: `YYYYMMDDT0000` (start of first day)
  - `to_time`: `YYYYMMDDT2359` (end of second day)
- Calls `pullNews(from_time, to_time)` from `src/business.ts`
- Example: `bun src/run-stocks.ts --pull-news 20251201-20251202`
  - Converts to: `from_time: 20251201T0000, to_time: 20251202T2359`

##### 3. Query Stock Data from MongoDB
```bash
bun src/run-stocks.ts --symbol <symbol> [--date <YYYYMMDD>]
```
- Queries the `stock-<symbol>` collection in the `finance` database
- If `--date` is provided:
  - Returns the stock price document for that specific date
  - Date format: `YYYYMMDD` (e.g., `20251223`)
  - Convert to MongoDB query format: `YYYY-MM-DD` (e.g., `2025-12-23`)
- If `--date` is NOT provided:
  - Returns the latest 100 daily prices
  - Sort by `date` descending
  - Limit to 100 documents
- Output format: JSON (pretty-printed)
- Examples:
  - `bun src/run-stocks.ts --symbol IBM --date 20251223`
  - `bun src/run-stocks.ts --symbol AAPL`

##### 4. Query News Data from MongoDB
```bash
bun src/run-stocks.ts --news --from <date1> --to <date2>
```
- Queries the `news` collection in the `finance` database
- `--from` and `--to` are in format `YYYYMMDD`
- Convert to query format for `time_published` field:
  - `time_published >= YYYYMMDDT0000` (from)
  - `time_published <= YYYYMMDDT2359` (to)
- Use MongoDB's `$gte` and `$lte` operators for range query
- Output format: JSON (pretty-printed)
- Example: `bun src/run-stocks.ts --news --from 20251221 --to 20251222`

##### 5. Help
```bash
bun src/run-stocks.ts --help
```
- Displays detailed help information with all commands and examples

### Implementation Details

#### Date Format Conversion Functions

Implement helper functions for date conversions:

```typescript
/**
 * Converts YYYYMMDD to YYYY-MM-DD (MongoDB stock date format)
 */
function formatStockDate(dateStr: string): string {
  // Input: 20251223 -> Output: 2025-12-23
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

/**
 * Converts YYYYMMDD-YYYYMMDD to API time format
 */
function parseDateRange(rangeStr: string): { from_time: string; to_time: string } {
  // Input: 20251201-20251202
  // Output: { from_time: "20251201T0000", to_time: "20251202T2359" }
  const [from, to] = rangeStr.split("-");
  return {
    from_time: `${from}T0000`,
    to_time: `${to}T2359`
  };
}

/**
 * Converts YYYYMMDD to news time_published format for queries
 */
function formatNewsTime(dateStr: string, isEnd: boolean = false): string {
  // If isEnd=false: 20251221 -> 20251221T0000
  // If isEnd=true:  20251222 -> 20251222T2359
  return isEnd ? `${dateStr}T2359` : `${dateStr}T0000`;
}
```

#### Yargs Configuration

Use yargs with the following structure:

```typescript
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: bun src/run-stocks.ts [options]")
  .option("pull-stock", {
    type: "string",
    description: "Pull stock data for a symbol from Alpha Vantage API",
    alias: "ps"
  })
  .option("pull-news", {
    type: "string",
    description: "Pull news data for a date range (YYYYMMDD-YYYYMMDD)",
    alias: "pn"
  })
  .option("symbol", {
    type: "string",
    description: "Query stock data for a symbol from MongoDB",
    alias: "s"
  })
  .option("date", {
    type: "string",
    description: "Specific date for stock query (YYYYMMDD)",
    alias: "d"
  })
  .option("news", {
    type: "boolean",
    description: "Query news data from MongoDB",
    alias: "n"
  })
  .option("from", {
    type: "string",
    description: "Start date for news query (YYYYMMDD)",
    alias: "f"
  })
  .option("to", {
    type: "string",
    description: "End date for news query (YYYYMMDD)",
    alias: "t"
  })
  .example([
    ["bun src/run-stocks.ts --pull-stock AAPL", "Pull AAPL stock data from Alpha Vantage API"],
    ["bun src/run-stocks.ts --pull-news 20251201-20251202", "Pull news from Dec 1-2, 2025"],
    ["bun src/run-stocks.ts --symbol IBM", "Get latest 100 IBM stock prices"],
    ["bun src/run-stocks.ts --symbol IBM --date 20251223", "Get IBM price for Dec 23, 2025"],
    ["bun src/run-stocks.ts --news --from 20251221 --to 20251222", "Query news from Dec 21-22"]
  ])
  .help()
  .alias("help", "h")
  .parseSync();
```

#### Main Logic Flow

```typescript
async function main() {
  const client = await connect();

  try {
    if (argv["pull-stock"]) {
      // Handle --pull-stock <symbol>
      const symbol = argv["pull-stock"];
      const count = await pullStock(symbol);
      console.log(`Successfully pulled ${count} stock records for ${symbol}`);
    }
    else if (argv["pull-news"]) {
      // Handle --pull-news <date-range>
      const { from_time, to_time } = parseDateRange(argv["pull-news"]);
      const count = await pullNews(from_time, to_time);
      console.log(`Successfully pulled ${count} news articles`);
    }
    else if (argv.symbol) {
      // Handle --symbol <symbol> [--date <date>]
      const symbol = argv.symbol;
      const collectionName = `stock-${symbol}`;

      if (argv.date) {
        // Query specific date
        const dateFormatted = formatStockDate(argv.date);
        const docs = await findDocuments("finance", collectionName, { date: dateFormatted });
        if (docs.length === 0) {
          console.log(`No stock data found for ${symbol} on ${dateFormatted}`);
        } else {
          console.log(JSON.stringify(docs[0], null, 2));
        }
      } else {
        // Query latest 100 prices
        const docs = await findDocuments("finance", collectionName, {}, {
          sort: { date: -1 },
          limit: 100
        });
        console.log(JSON.stringify(docs, null, 2));
      }
    }
    else if (argv.news) {
      // Handle --news --from <date1> --to <date2>
      if (!argv.from || !argv.to) {
        console.error("Error: --news requires both --from and --to options");
        process.exit(1);
      }

      const fromTime = formatNewsTime(argv.from, false);
      const toTime = formatNewsTime(argv.to, true);

      const docs = await findDocuments("finance", "news", {
        time_published: {
          $gte: fromTime,
          $lte: toTime
        }
      });
      console.log(JSON.stringify(docs, null, 2));
    }
    else {
      // No valid command provided, show help
      yargs(hideBin(process.argv)).showHelp();
    }
  } finally {
    await disconnect(client);
  }
}

main().catch(console.error);
```

### Detailed Help Output

When running `--help`, the output should look like:

```
Usage: bun src/run-stocks.ts [options]

Options:
      --version     Show version number                              [boolean]
      --pull-stock  Pull stock data for a symbol from Alpha Vantage API
                                                                      [string]
      --pull-news   Pull news data for a date range (YYYYMMDD-YYYYMMDD)
                                                                      [string]
  -s, --symbol      Query stock data for a symbol from MongoDB        [string]
  -d, --date        Specific date for stock query (YYYYMMDD)          [string]
  -n, --news        Query news data from MongoDB                     [boolean]
  -f, --from        Start date for news query (YYYYMMDD)              [string]
  -t, --to          End date for news query (YYYYMMDD)                [string]
  -h, --help        Show help                                        [boolean]

Examples:
  bun src/run-stocks.ts --pull-stock AAPL       Pull AAPL stock data from Alpha
                                                 Vantage API
  bun src/run-stocks.ts --pull-news             Pull news from Dec 1-2, 2025
  20251201-20251202
  bun src/run-stocks.ts --symbol IBM            Get latest 100 IBM stock prices
  bun src/run-stocks.ts --symbol IBM --date     Get IBM price for Dec 23, 2025
  20251223
  bun src/run-stocks.ts --news --from           Query news from Dec 21-22
  20251221 --to 20251222
```

### Error Handling

Implement proper error handling for:

1. **Invalid date format**:
   - `--pull-news` must be `YYYYMMDD-YYYYMMDD`
   - `--date` must be `YYYYMMDD`
   - `--from` and `--to` must be `YYYYMMDD`

2. **Missing required options**:
   - `--news` requires both `--from` and `--to`

3. **MongoDB errors**:
   - Connection failures
   - Query errors

4. **API errors**:
   - Network failures
   - Invalid responses

Example validation:
```typescript
function validateDateFormat(dateStr: string): boolean {
  return /^\d{8}$/.test(dateStr);
}

function validateDateRange(rangeStr: string): boolean {
  return /^\d{8}-\d{8}$/.test(rangeStr);
}
```

### Implementation Steps

1. **Add `findDocuments` function to `src/mongo.ts`** - Required for query operations
2. Install yargs: `bun add yargs @types/yargs`
3. Create `src/run-stocks.ts` following the specification above
4. Implement date conversion helper functions
5. Set up yargs with all options and examples
6. Implement the main logic with proper command routing
7. Add error handling and validation
8. Test all commands manually:
   - `bun src/run-stocks.ts --help`
   - `bun src/run-stocks.ts --symbol IBM`
   - `bun src/run-stocks.ts --symbol IBM --date 20251223`
   - `bun src/run-stocks.ts --news --from 20251221 --to 20251222`
   - `bun src/run-stocks.ts --pull-stock MSFT` (if API quota available)
   - `bun src/run-stocks.ts --pull-news 20251220-20251221` (if API quota available)

### Complete Implementation Example

```typescript
#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { connect, disconnect, findDocuments } from "./mongo";
import { pullStock, pullNews } from "./business";
import type { StockData, NewsItem } from "./business";

// Date format conversion helpers
function formatStockDate(dateStr: string): string {
  if (!/^\d{8}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD`);
  }
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function parseDateRange(rangeStr: string): { from_time: string; to_time: string } {
  if (!/^\d{8}-\d{8}$/.test(rangeStr)) {
    throw new Error(`Invalid date range format: ${rangeStr}. Expected YYYYMMDD-YYYYMMDD`);
  }
  const [from, to] = rangeStr.split("-");
  return {
    from_time: `${from}T0000`,
    to_time: `${to}T2359`
  };
}

function formatNewsTime(dateStr: string, isEnd: boolean = false): string {
  if (!/^\d{8}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD`);
  }
  return isEnd ? `${dateStr}T2359` : `${dateStr}T0000`;
}

// Main CLI setup
const argv = yargs(hideBin(process.argv))
  .usage("Usage: bun src/run-stocks.ts [options]")
  .option("pull-stock", {
    type: "string",
    description: "Pull stock data for a symbol from Alpha Vantage API",
    alias: "ps"
  })
  .option("pull-news", {
    type: "string",
    description: "Pull news data for a date range (YYYYMMDD-YYYYMMDD)",
    alias: "pn"
  })
  .option("symbol", {
    type: "string",
    description: "Query stock data for a symbol from MongoDB",
    alias: "s"
  })
  .option("date", {
    type: "string",
    description: "Specific date for stock query (YYYYMMDD)",
    alias: "d"
  })
  .option("news", {
    type: "boolean",
    description: "Query news data from MongoDB",
    alias: "n"
  })
  .option("from", {
    type: "string",
    description: "Start date for news query (YYYYMMDD)",
    alias: "f"
  })
  .option("to", {
    type: "string",
    description: "End date for news query (YYYYMMDD)",
    alias: "t"
  })
  .example([
    ["bun src/run-stocks.ts --pull-stock AAPL", "Pull AAPL stock data from Alpha Vantage API"],
    ["bun src/run-stocks.ts --pull-news 20251201-20251202", "Pull news from Dec 1-2, 2025"],
    ["bun src/run-stocks.ts --symbol IBM", "Get latest 100 IBM stock prices"],
    ["bun src/run-stocks.ts --symbol IBM --date 20251223", "Get IBM price for Dec 23, 2025"],
    ["bun src/run-stocks.ts --news --from 20251221 --to 20251222", "Query news from Dec 21-22"]
  ])
  .help()
  .alias("help", "h")
  .parseSync();

async function main() {
  const client = await connect();

  try {
    if (argv["pull-stock"]) {
      const symbol = argv["pull-stock"];
      console.log(`Pulling stock data for ${symbol}...`);
      const count = await pullStock(symbol);
      console.log(`Successfully pulled ${count} stock records for ${symbol}`);
    }
    else if (argv["pull-news"]) {
      const { from_time, to_time } = parseDateRange(argv["pull-news"]);
      console.log(`Pulling news from ${from_time} to ${to_time}...`);
      const count = await pullNews(from_time, to_time);
      console.log(`Successfully pulled ${count} news articles`);
    }
    else if (argv.symbol) {
      const symbol = argv.symbol;
      const collectionName = `stock-${symbol}`;

      if (argv.date) {
        const dateFormatted = formatStockDate(argv.date);
        const docs = await findDocuments<StockData>("finance", collectionName, { date: dateFormatted });
        if (docs.length === 0) {
          console.log(`No stock data found for ${symbol} on ${dateFormatted}`);
        } else {
          console.log(JSON.stringify(docs[0], null, 2));
        }
      } else {
        const docs = await findDocuments<StockData>("finance", collectionName, {}, {
          sort: { date: -1 },
          limit: 100
        });
        if (docs.length === 0) {
          console.log(`No stock data found for ${symbol}`);
        } else {
          console.log(JSON.stringify(docs, null, 2));
        }
      }
    }
    else if (argv.news) {
      if (!argv.from || !argv.to) {
        console.error("Error: --news requires both --from and --to options");
        console.error("Example: bun src/run-stocks.ts --news --from 20251221 --to 20251222");
        process.exit(1);
      }

      const fromTime = formatNewsTime(argv.from, false);
      const toTime = formatNewsTime(argv.to, true);

      console.log(`Querying news from ${fromTime} to ${toTime}...`);
      const docs = await findDocuments<NewsItem>("finance", "news", {
        time_published: {
          $gte: fromTime,
          $lte: toTime
        }
      });

      if (docs.length === 0) {
        console.log(`No news found between ${argv.from} and ${argv.to}`);
      } else {
        console.log(`Found ${docs.length} news articles:`);
        console.log(JSON.stringify(docs, null, 2));
      }
    }
    else {
      yargs(hideBin(process.argv)).showHelp();
    }
  } finally {
    await disconnect(client);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
```

### Important Notes

- Always connect to MongoDB at the start and disconnect at the end
- Use proper TypeScript types for stock and news documents
- Handle all edge cases (empty results, invalid inputs, etc.)
- The CLI should be executable with `bun src/run-stocks.ts`
- API pull operations will consume Alpha Vantage quota (25/day for free tier)
- Query operations only read from MongoDB and don't consume API quota
