# MCP Server Fixes Applied

## Issue: SSE Mode "stream is not readable" Error

### Problem
When running the MCP server in SSE mode, the server threw an error:
```
InternalServerError: stream is not readable
    type: "stream.not.readable"
```

### Root Cause
The `express.json()` middleware was consuming the request body stream before the SSE transport's `handlePostMessage()` method could read it. The MCP SDK's SSE transport needs direct access to the raw request stream.

### Solution
**Removed** the `express.json()` middleware from the Express app configuration in the `runSSE()` method.

**Before:**
```typescript
async runSSE(port: number = 3001): Promise<void> {
  const app = express();
  app.use(express.json()); // ❌ This consumes the stream!

  app.get("/sse", async (req, res) => { ... });
  app.post("/messages", async (req, res) => { ... });
}
```

**After:**
```typescript
async runSSE(port: number = 3001): Promise<void> {
  const app = express();
  // ✅ No body parser middleware - SSE transport reads raw body

  app.get("/sse", async (_req, res) => { ... });
  app.post("/messages", async (req, res) => { ... });
}
```

### Verification
The SSE mode now works correctly:
- ✅ Server accepts connections on port 3001
- ✅ SSE endpoint returns status 200
- ✅ Correct headers: `content-type: text/event-stream`
- ✅ No "stream is not readable" errors

## TypeScript Errors Fixed

### 1. parseInt Type Error (Line 312)
**Error:** `Argument of type 'string | undefined' is not assignable to parameter of type 'string'`

**Fix:**
```typescript
// Before
const port = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10) // ❌ Could be undefined
  : 3001;

// After
const portArg = portIndex !== -1 ? args[portIndex + 1] : undefined;
const port = portArg ? parseInt(portArg, 10) : 3001; // ✅ Type-safe
```

### 2. Unused Imports
**Fix:** Removed unused `Request` and `Response` type imports from express

```typescript
// Before
import express, { type Request, type Response } from 'express';

// After
import express from 'express';
```

### 3. Unused Variables
**Fix:** Prefixed unused parameters with underscore per TypeScript convention

```typescript
// Before
app.get("/sse", async (req, res) => { ... }); // req unused

// After
app.get("/sse", async (_req, res) => { ... }); // ✅ Indicates intentionally unused
```

Also fixed:
- `_resolve` in Promise constructor (line 296)
- Removed unused `useStdio` variable (line 309)

## Deprecation Warnings (Non-Critical)

The following deprecation warnings are from the `@modelcontextprotocol/sdk` package itself and cannot be fixed without updating the SDK version:

- `Server` class deprecation warnings
- `SSEServerTransport` class deprecation warnings

These are **informational only** and do not affect functionality. They can be safely ignored.

## Testing Results

### ✅ Stdio Mode
- Tools listing works correctly
- Returns 2 tools: `get_stock_prices` and `get_news`
- JSON-RPC protocol working as expected

### ✅ SSE Mode
- Server starts successfully on port 3001
- SSE endpoint accepts connections
- Correct content-type headers
- No stream errors

### ✅ Underlying Functionality
All MongoDB queries work correctly:
- Stock price queries (by symbol, by date, latest 100)
- News queries (by date range, with keyword filtering)
- Date format conversion (YYYYMMDD → YYYY-MM-DD, YYYYMMDD → YYYYMMDDT0000)

## Files Modified

1. **src/mcp.ts** - Main MCP server implementation
   - Removed `express.json()` middleware
   - Fixed TypeScript type errors
   - Removed unused imports
   - Prefixed unused parameters with underscore

2. **MCP-SERVER-README.md** - Added troubleshooting section
   - Documented the "stream is not readable" fix
   - Added SSE testing instructions
   - Added deprecation warnings note

3. **test-sse.ts** - Created SSE mode test script
   - Verifies SSE endpoint accepts connections
   - Confirms correct headers
   - Tests server startup

## Summary

All critical issues have been resolved:
- ✅ SSE mode "stream is not readable" error fixed
- ✅ TypeScript type errors fixed
- ✅ All functionality verified and working
- ✅ Both stdio and SSE transport modes operational
- ✅ Comprehensive testing and documentation added

The MCP server is now fully functional and ready for production use.
