#!/usr/bin/env bun

/**
 * Simple MCP client to test the MCP server
 */

async function testMcpServer() {
  console.log("Testing MCP Server...\n");

  // We'll use the StdioClientTransport to connect
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

  const transport = new StdioClientTransport({
    command: "bun",
    args: ["src/mcp.ts", "--stdio"],
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    console.log("Connecting to MCP server...");
    await client.connect(transport);
    console.log("Connected!\n");

    // Test 1: List tools
    console.log("=== Test 1: List Tools ===");
    const toolsResult = await client.request({ method: "tools/list" }, {} as any);
    console.log("Available tools:", JSON.stringify(toolsResult, null, 2));
    console.log();

    // Test 2: Get stock prices for AAPL on 20251223
    console.log("=== Test 2: Get AAPL stock prices for 20251223 ===");
    const stockResult = await client.request(
      { method: "tools/call" },
      {
        name: "get_stock_prices",
        arguments: {
          symbol: "AAPL",
          date: "20251223",
        },
      } as any
    );
    console.log("Result:", JSON.stringify(stockResult, null, 2));
    console.log();

    // Test 3: Get latest 100 IBM stock prices
    console.log("=== Test 3: Get latest 100 IBM stock prices ===");
    const ibmResult = await client.request(
      { method: "tools/call" },
      {
        name: "get_stock_prices",
        arguments: {
          symbol: "IBM",
        },
      } as any
    );
    const ibmData = JSON.parse((ibmResult as any).content[0].text);
    console.log(`Found ${ibmData.data?.length || 0} records for IBM`);
    console.log("First record:", ibmData.data?.[0]);
    console.log();

    // Test 4: Get news between dates
    console.log("=== Test 4: Get news between 20251221 and 20251222 ===");
    const newsResult = await client.request(
      { method: "tools/call" },
      {
        name: "get_news",
        arguments: {
          from: "20251221",
          to: "20251222",
        },
      } as any
    );
    const newsData = JSON.parse((newsResult as any).content[0].text);
    console.log(`Found ${newsData.count || 0} news articles`);
    if (newsData.data?.[0]) {
      console.log("First article title:", newsData.data[0].title);
    }
    console.log();

    // Test 5: Get news with keyword filter
    console.log("=== Test 5: Get news with keyword 'trading' ===");
    const newsKeywordResult = await client.request(
      { method: "tools/call" },
      {
        name: "get_news",
        arguments: {
          from: "20251221",
          to: "20251222",
          keyword: "trading",
        },
      } as any
    );
    const newsKeywordData = JSON.parse((newsKeywordResult as any).content[0].text);
    console.log(`Found ${newsKeywordData.count || 0} news articles matching 'trading'`);
    if (newsKeywordData.data?.[0]) {
      console.log("First article title:", newsKeywordData.data[0].title);
    }
    console.log();

    console.log("All tests completed successfully!");

    // Close the connection
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error("Error during testing:", error);
    process.exit(1);
  }
}

testMcpServer();
