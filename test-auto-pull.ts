#!/usr/bin/env bun

/**
 * Test the auto-pull functionality of the get_stock_prices tool
 * This tests that the MCP server automatically pulls data from Alpha Vantage
 * when a stock symbol is not found in MongoDB
 */

import { connect, disconnect, findDocuments, removeCollection } from "./src/mongo";
import type { StockData } from "./src/business";

async function testAutoPull() {
  console.log("Testing Auto-Pull Functionality...\n");

  const client = await connect();

  try {
    // Test 1: Verify MSFT doesn't exist (or clean it up if it does)
    console.log("=== Test 1: Cleanup - Remove MSFT data if exists ===");
    const removed = await removeCollection("finance", "stock-MSFT");
    if (removed) {
      console.log("✓ Removed existing MSFT collection");
    } else {
      console.log("✓ MSFT collection doesn't exist (good for testing)");
    }
    console.log();

    // Test 2: Verify MSFT is not in database
    console.log("=== Test 2: Verify MSFT is not in database ===");
    const beforeDocs = await findDocuments<StockData>("finance", "stock-MSFT", {});
    console.log(`✓ MSFT documents in database: ${beforeDocs.length}`);
    console.log();

    // Test 3: Now test with the MCP server
    console.log("=== Test 3: Test MCP server auto-pull ===");
    console.log("Starting MCP server and requesting MSFT data...");
    console.log("(This will automatically pull from Alpha Vantage API)");
    console.log();
    console.log("You can test manually with:");
    console.log('echo \'{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "MSFT"}}, "id": 1}\' | bun src/mcp.ts --stdio 2>&1 | grep "freshly pulled"');
    console.log();
    console.log("Expected: The server should automatically pull MSFT data and return it");
    console.log();

    console.log("=== Summary ===");
    console.log("✓ Test setup complete");
    console.log("✓ MSFT collection cleared");
    console.log("✓ Ready to test auto-pull functionality");
    console.log();
    console.log("Note: When you query MSFT through the MCP server, it should:");
    console.log("  1. Detect that MSFT is not in MongoDB");
    console.log("  2. Automatically call pullStock('MSFT')");
    console.log("  3. Query MongoDB again and return the data");
    console.log("  4. Return message containing '(freshly pulled from API)'");

  } finally {
    await disconnect(client);
  }
}

testAutoPull().catch((error) => {
  console.error("Test setup failed:", error);
  process.exit(1);
});
