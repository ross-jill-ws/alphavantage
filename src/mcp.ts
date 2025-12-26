#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import { connect, disconnect, findDocuments } from "./mongo";
import type { StockData, NewsItem } from "./business";
import { pullStock } from "./business";

// ============================================================================
// Tool Definitions
// ============================================================================

const tools = [
  {
    name: "get_stock_prices",
    description: "Query stock price data from MongoDB for a given stock symbol. Returns daily OHLCV (Open, High, Low, Close, Volume) data. If the data is not found in MongoDB, it will automatically pull it from the Alpha Vantage API first. If a specific date is provided, returns data for that date only. Otherwise, returns the latest 100 trading days sorted by date descending. Example response: {\"symbol\": \"AAPL\", \"date\": \"2025-12-23\", \"open\": 270.97, \"high\": 272.45, \"low\": 269.56, \"close\": 272.36, \"volume\": 29360026}",
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
  },
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
];

// ============================================================================
// Date Conversion Helpers
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
 * Converts YYYYMMDD to news time_published format for queries
 */
function formatNewsTime(dateStr: string, isEnd: boolean = false): string {
  if (!/^\d{8}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD`);
  }
  return isEnd ? `${dateStr}T2359` : `${dateStr}T0000`;
}

// ============================================================================
// MCP Server Implementation
// ============================================================================

class AlphaVantageMcpServer {
  private server: Server;
  private mongoClient: any = null;

  constructor() {
    this.server = new Server(
      {
        name: "alphavantage-mcp-server",
        description: "Alpha Vantage Stock and News Data MCP Server",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      console.error("SIGINT received, shutting down...");
      if (this.mongoClient) {
        await disconnect(this.mongoClient);
      }
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools
    }));

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const tool = tools.find(t => t.name === request.params.name);
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
        }

        try {
          // Ensure MongoDB is connected
          if (!this.mongoClient) {
            this.mongoClient = await connect();
          }

          let result;

          if (request.params.name === "get_stock_prices") {
            const { symbol, date } = request.params.arguments as { symbol: string; date?: string };
            result = await this.processGetStockPrices(symbol, date);
          } else if (request.params.name === "get_news") {
            const { from, to, keyword } = request.params.arguments as { from: string; to: string; keyword?: string };
            result = await this.processGetNews(from, to, keyword);
          } else {
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool not implemented: ${request.params.name}`
            );
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error("Error executing tool:", error);
          return {
            content: [{
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Process get_stock_prices tool
   * Automatically pulls data from Alpha Vantage API if not found in MongoDB
   */
  private async processGetStockPrices(symbol: string, date?: string): Promise<any> {
    const collectionName = `stock-${symbol}`;

    if (date) {
      // Query specific date
      const dateFormatted = formatStockDate(date);
      let docs = await findDocuments<StockData>("finance", collectionName, { date: dateFormatted });

      // If not found, pull from API and try again
      if (docs.length === 0) {
        try {
          console.error(`Stock data not found for ${symbol}, pulling from Alpha Vantage API...`);
          const count = await pullStock(symbol);
          console.error(`Pulled ${count} records for ${symbol}`);

          // Query again after pulling
          docs = await findDocuments<StockData>("finance", collectionName, { date: dateFormatted });

          if (docs.length === 0) {
            return {
              message: `No stock data found for ${symbol} on ${dateFormatted} (even after pulling from API)`,
              data: null
            };
          }

          return {
            message: `Stock data for ${symbol} on ${dateFormatted} (freshly pulled from API)`,
            data: docs[0]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Check if it's a .keylist error
          if (errorMessage.includes('.keylist') || errorMessage.includes('ENOENT')) {
            return {
              message: `No stock data found for ${symbol}. Auto-pull failed: .keylist file not found. Please create a .keylist file with your Alpha Vantage API key(s), or manually pull the data using: bun src/run-stocks.ts --pull-stock ${symbol}`,
              data: null,
              error: "Missing .keylist file"
            };
          }

          // Other errors
          return {
            message: `No stock data found for ${symbol}. Auto-pull failed: ${errorMessage}`,
            data: null,
            error: errorMessage
          };
        }
      }

      return {
        message: `Stock data for ${symbol} on ${dateFormatted}`,
        data: docs[0]
      };
    } else {
      // Query latest 100 prices
      let docs = await findDocuments<StockData>("finance", collectionName, {}, {
        sort: { date: -1 },
        limit: 100
      });

      // If not found, pull from API and try again
      if (docs.length === 0) {
        try {
          console.error(`Stock data not found for ${symbol}, pulling from Alpha Vantage API...`);
          const count = await pullStock(symbol);
          console.error(`Pulled ${count} records for ${symbol}`);

          // Query again after pulling
          docs = await findDocuments<StockData>("finance", collectionName, {}, {
            sort: { date: -1 },
            limit: 100
          });

          if (docs.length === 0) {
            return {
              message: `No stock data found for ${symbol} (even after pulling from API)`,
              data: []
            };
          }

          return {
            message: `Found ${docs.length} stock price records for ${symbol} (freshly pulled from API)`,
            data: docs
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Check if it's a .keylist error
          if (errorMessage.includes('.keylist') || errorMessage.includes('ENOENT')) {
            return {
              message: `No stock data found for ${symbol}. Auto-pull failed: .keylist file not found. Please create a .keylist file with your Alpha Vantage API key(s), or manually pull the data using: bun src/run-stocks.ts --pull-stock ${symbol}`,
              data: [],
              error: "Missing .keylist file"
            };
          }

          // Other errors
          return {
            message: `No stock data found for ${symbol}. Auto-pull failed: ${errorMessage}`,
            data: [],
            error: errorMessage
          };
        }
      }

      return {
        message: `Found ${docs.length} stock price records for ${symbol}`,
        data: docs
      };
    }
  }

  /**
   * Process get_news tool
   */
  private async processGetNews(from: string, to: string, keyword?: string): Promise<any> {
    const fromTime = formatNewsTime(from, false);
    const toTime = formatNewsTime(to, true);

    // Base filter
    const filter: Record<string, any> = {
      time_published: {
        $gte: fromTime,
        $lte: toTime
      }
    };

    // Add keyword filter if provided
    if (keyword) {
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { summary: { $regex: keyword, $options: "i" } }
      ];
    }

    const docs = await findDocuments<NewsItem>("finance", "news", filter);

    const keywordInfo = keyword ? ` matching keyword "${keyword}"` : "";

    if (docs.length === 0) {
      return {
        message: `No news articles found between ${from} and ${to}${keywordInfo}`,
        count: 0,
        data: []
      };
    }

    return {
      message: `Found ${docs.length} news articles between ${from} and ${to}${keywordInfo}`,
      count: docs.length,
      data: docs
    };
  }

  async runStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Alpha Vantage MCP server running on stdio");
  }

  async runSSE(port: number = 3001): Promise<void> {
    const app = express();

    // Do NOT use express.json() middleware - SSE transport needs to read raw body

    app.get("/sse", async (_req, res) => {
      const transport = new SSEServerTransport("/messages", res);
      await this.server.connect(transport);
      app.locals.transport = transport;
    });

    app.post("/messages", async (req, res) => {
      const transport = app.locals.transport;
      await transport.handlePostMessage(req, res);
    });

    return new Promise((_resolve) => {
      app.listen(port, () => {
        console.error(`Alpha Vantage MCP server running on SSE at http://localhost:${port}`);
      });
    });
  }
}

// ============================================================================
// Main Execution
// ============================================================================

const args = process.argv.slice(2);
const useSSE = args.includes('--sse');

const portIndex = args.indexOf('--port');
const portArg = portIndex !== -1 ? args[portIndex + 1] : undefined;
const port = portArg ? parseInt(portArg, 10) : 3001;

const server = new AlphaVantageMcpServer();
if (useSSE) {
  console.error(`Starting server in SSE mode on port ${port}`);
  server.runSSE(port).catch(console.error);
} else {
  console.error("Starting server in stdio mode");
  server.runStdio().catch(console.error);
}

export { AlphaVantageMcpServer };
