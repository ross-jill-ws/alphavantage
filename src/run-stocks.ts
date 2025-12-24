#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { connect, disconnect, findDocuments } from "./mongo";
import { pullStock, pullNews } from "./business";
import type { StockData, NewsItem } from "./business";

// ============================================================================
// Date Format Conversion Helpers
// ============================================================================

/**
 * Converts YYYYMMDD to YYYY-MM-DD (MongoDB stock date format)
 */
function formatStockDate(dateStr: string): string {
  if (!/^\d{8}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD`);
  }
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

/**
 * Converts YYYYMMDD-YYYYMMDD to API time format
 */
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

/**
 * Converts YYYYMMDD to news time_published format for queries
 */
function formatNewsTime(dateStr: string, isEnd: boolean = false): string {
  if (!/^\d{8}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD`);
  }
  return isEnd ? `${dateStr}T2359` : `${dateStr}T0000`;
}

// ============================================================================
// CLI Configuration
// ============================================================================

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

// ============================================================================
// Main CLI Logic
// ============================================================================

async function main() {
  const client = await connect();

  try {
    if (argv["pull-stock"]) {
      // Handle --pull-stock <symbol>
      const symbol = argv["pull-stock"];
      console.log(`Pulling stock data for ${symbol}...`);
      const count = await pullStock(symbol);
      console.log(`Successfully pulled ${count} stock records for ${symbol}`);
    }
    else if (argv["pull-news"]) {
      // Handle --pull-news <date-range>
      const { from_time, to_time } = parseDateRange(argv["pull-news"]);
      console.log(`Pulling news from ${from_time} to ${to_time}...`);
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
        const docs = await findDocuments<StockData>("finance", collectionName, { date: dateFormatted });
        if (docs.length === 0) {
          console.log(`No stock data found for ${symbol} on ${dateFormatted}`);
        } else {
          console.log(JSON.stringify(docs[0], null, 2));
        }
      } else {
        // Query latest 100 prices
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
      // Handle --news --from <date1> --to <date2>
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
      // No valid command provided, show help
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
