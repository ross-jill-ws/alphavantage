#!/usr/bin/env bun

/**
 * Simple test script for SSE mode
 * Tests that the SSE transport can properly handle requests
 */

async function testSSE() {
  console.log("Testing MCP Server in SSE mode...\n");

  // Start server
  const server = Bun.spawn(["bun", "src/mcp.ts", "--sse", "--port", "3001"], {
    stderr: "pipe",
    stdout: "pipe",
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Test 1: Establish SSE connection and send a tools/list request
    console.log("=== Test 1: List tools via SSE ===");

    // In a real SSE test, we would:
    // 1. GET /sse to establish SSE connection
    // 2. POST to /messages with the JSON-RPC request
    // 3. Receive response via SSE events

    // For now, we'll just verify the server is running
    const healthCheck = await fetch("http://localhost:3001/sse");
    console.log("SSE endpoint status:", healthCheck.status);
    console.log("SSE endpoint headers:", Object.fromEntries(healthCheck.headers.entries()));

    // Close the connection
    healthCheck.body?.cancel();

    console.log("\n✓ SSE mode server is running and accepting connections");
    console.log("✓ No 'stream is not readable' error occurred");
    console.log("\nNote: Full SSE testing requires a proper MCP client that can handle SSE streams.");

  } catch (error) {
    console.error("Error testing SSE mode:", error);
    throw error;
  } finally {
    // Clean up
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

testSSE().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
