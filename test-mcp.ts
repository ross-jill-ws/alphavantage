#!/usr/bin/env bun

/**
 * Simple test script to verify MCP server is working
 * Tests the stdio transport by sending initialize and list_tools requests
 */

import { spawn } from "child_process";

const mcp = spawn("bun", ["src/mcp.ts"], {
  stdio: ["pipe", "pipe", "inherit"]
});

let responseCount = 0;
let buffer = "";

mcp.stdout?.on("data", (data) => {
  buffer += data.toString();

  // Try to parse JSON-RPC messages (one per line)
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const response = JSON.parse(line);
      console.log("Response:", JSON.stringify(response, null, 2));
      responseCount++;

      // Exit after getting list_tools response
      if (responseCount >= 2) {
        console.log("\n✓ MCP server is working correctly!");
        mcp.kill();
        process.exit(0);
      }
    } catch (error) {
      console.error("Failed to parse response:", line);
    }
  }
});

mcp.on("error", (error) => {
  console.error("MCP process error:", error);
  process.exit(1);
});

mcp.on("exit", (code) => {
  if (code !== 0 && responseCount < 2) {
    console.error(`MCP process exited with code ${code}`);
    process.exit(1);
  }
});

// Send initialize request
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  }
};

console.log("Sending initialize request...");
mcp.stdin?.write(JSON.stringify(initRequest) + "\n");

// Send list_tools request after a short delay
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };

  console.log("\nSending list_tools request...");
  mcp.stdin?.write(JSON.stringify(listToolsRequest) + "\n");
}, 1000);

// Timeout if no response after 10 seconds
setTimeout(() => {
  console.error("\n✗ Timeout: No response from MCP server");
  mcp.kill();
  process.exit(1);
}, 10000);
