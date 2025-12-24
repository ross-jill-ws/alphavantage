#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tool-definitions.js";
import { connect, disconnect } from "./mongo.js";
import { pullStock, pullNews } from "./business.js";
import express, { type Request, type Response } from "express";
import type { MongoClient } from "mongodb";

class AlphaVantageMcpServer {
  private server: Server;
  private mongoClient: MongoClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "alphavantage-mcp",
        description: "Alpha Vantage Stock and News MCP Server",
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
      await this.cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("SIGTERM received, shutting down...");
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    if (this.mongoClient) {
      await disconnect(this.mongoClient);
      this.mongoClient = null;
    }
    await this.server.close();
  }

  private async ensureMongoConnection(): Promise<void> {
    if (!this.mongoClient) {
      this.mongoClient = await connect();
    }
  }

  private setupHandlers(): void {
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools
    }));

    // Handle tool calls
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
          // Ensure MongoDB connection before any tool execution
          await this.ensureMongoConnection();

          let result: { success: boolean; message: string; data?: any };

          if (request.params.name === "pull_stock_prices") {
            const { symbol } = request.params.arguments as { symbol: string };
            result = await this.processPullStock(symbol);
          } else if (request.params.name === "pull_news") {
            const { start_date, end_date } = request.params.arguments as {
              start_date: string;
              end_date: string;
            };
            result = await this.processPullNews(start_date, end_date);
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
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Process pull_stock_prices tool call
   */
  private async processPullStock(symbol: string): Promise<{
    success: boolean;
    message: string;
    data: { symbol: string; records_pulled: number; collection: string };
  }> {
    // Validate symbol
    if (!symbol || typeof symbol !== "string") {
      throw new Error("Symbol is required and must be a string");
    }

    const normalizedSymbol = symbol.toUpperCase().trim();
    if (!/^[A-Z]{1,5}$/.test(normalizedSymbol)) {
      throw new Error(`Invalid symbol format: ${symbol}. Must be 1-5 uppercase letters.`);
    }

    console.error(`Pulling stock data for ${normalizedSymbol}...`);
    const count = await pullStock(normalizedSymbol);

    return {
      success: true,
      message: `Successfully pulled ${count} stock records for ${normalizedSymbol}`,
      data: {
        symbol: normalizedSymbol,
        records_pulled: count,
        collection: `stock-${normalizedSymbol}`
      }
    };
  }

  /**
   * Process pull_news tool call
   */
  private async processPullNews(startDate: string, endDate: string): Promise<{
    success: boolean;
    message: string;
    data: { start_date: string; end_date: string; articles_pulled: number };
  }> {
    // Validate date formats
    if (!startDate || !endDate) {
      throw new Error("Both start_date and end_date are required");
    }

    if (!/^\d{8}$/.test(startDate)) {
      throw new Error(`Invalid start_date format: ${startDate}. Expected YYYYMMDD`);
    }

    if (!/^\d{8}$/.test(endDate)) {
      throw new Error(`Invalid end_date format: ${endDate}. Expected YYYYMMDD`);
    }

    // Convert to API format
    const fromTime = `${startDate}T0000`;
    const toTime = `${endDate}T2359`;

    console.error(`Pulling news from ${fromTime} to ${toTime}...`);
    const count = await pullNews(fromTime, toTime);

    return {
      success: true,
      message: `Successfully pulled ${count} news articles`,
      data: {
        start_date: startDate,
        end_date: endDate,
        articles_pulled: count
      }
    };
  }

  /**
   * Starts the MCP server in stdio mode for CLI usage
   */
  async runStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Alpha Vantage MCP server running on stdio");
  }

  /**
   * Starts the MCP server in SSE mode for HTTP streaming
   */
  async runSSE(port: number = 3001): Promise<void> {
    const app = express();

    app.get("/sse", async (req: Request, res: Response) => {
      const transport = new SSEServerTransport("/messages", res);
      await this.server.connect(transport);
      (app as any).locals.transport = transport;
    });

    app.post("/messages", async (req: Request, res: Response) => {
      const transport = (app as any).locals.transport;
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).json({ error: "No active SSE connection" });
      }
    });

    return new Promise((resolve) => {
      app.listen(port, () => {
        console.error(`Alpha Vantage MCP server running on SSE at http://localhost:${port}`);
        resolve();
      });
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const useSSE = args.includes("--sse");
const useStdio = args.includes("--stdio") || !useSSE;

// Parse --port argument
const portIndex = args.indexOf("--port");
const port = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : 3001;

// Start the server
const server = new AlphaVantageMcpServer();
if (useSSE) {
  console.error(`Starting server in SSE mode on port ${port}`);
  server.runSSE(port).catch(console.error);
} else {
  console.error("Starting server in stdio mode");
  server.runStdio().catch(console.error);
}

export { AlphaVantageMcpServer };
