#!/bin/bash

echo "Testing MCP Server..."
echo ""

# Test 1: List tools
echo "=== Test 1: List Tools ==="
echo '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' | bun src/mcp.ts --stdio 2>/dev/null
echo ""

# Test 2: Get stock prices for AAPL with specific date
echo "=== Test 2: Get AAPL stock prices for 20251223 ==="
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "AAPL", "date": "20251223"}}, "id": 2}' | bun src/mcp.ts --stdio 2>/dev/null
echo ""

# Test 3: Get latest 100 stock prices for IBM
echo "=== Test 3: Get latest 100 IBM stock prices ==="
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "IBM"}}, "id": 3}' | bun src/mcp.ts --stdio 2>/dev/null | head -30
echo ""

# Test 4: Get news between dates
echo "=== Test 4: Get news between 20251221 and 20251222 ==="
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_news", "arguments": {"from": "20251221", "to": "20251222"}}, "id": 4}' | bun src/mcp.ts --stdio 2>/dev/null | head -50
echo ""

# Test 5: Get news with keyword filter
echo "=== Test 5: Get news with keyword 'trading' ==="
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_news", "arguments": {"from": "20251221", "to": "20251222", "keyword": "trading"}}, "id": 5}' | bun src/mcp.ts --stdio 2>/dev/null | head -50
echo ""

echo "Tests completed!"
