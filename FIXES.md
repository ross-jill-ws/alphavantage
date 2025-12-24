# MCP Server Fixes

## Issues Fixed

### 1. `.keylist` File Not Found Error

**Problem:** The MCP server was unable to find the `.keylist` file when running, resulting in:
```
"error": "ENOENT: no such file or directory, open '.keylist'"
```

**Root Cause:** The `business.ts` file used a relative path `".keylist"` which failed when the MCP server's working directory was different from the project root.

**Solution:** Updated `src/business.ts` to resolve the `.keylist` path relative to the project root using:
```typescript
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KEYLIST_PATH = join(__dirname, "..", ".keylist");
```

This ensures the `.keylist` file is always found regardless of where the MCP server is executed from.

### 2. TypeScript Error: Undefined Port Argument

**Problem:** TypeScript compiler error at line 257 in `mcp.ts`:
```
Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

**Root Cause:** The expression `args[portIndex + 1]` could potentially be `undefined`, and TypeScript was complaining about passing this to `parseInt`.

**Solution:** Split the logic to explicitly handle the undefined case:
```typescript
// Before (problematic)
const port = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : 3001;

// After (fixed)
const portArg = portIndex !== -1 ? args[portIndex + 1] : undefined;
const port = portArg ? parseInt(portArg, 10) : 3001;
```

## Files Modified

1. **src/business.ts**
   - Added imports for path resolution
   - Added `KEYLIST_PATH` constant
   - Updated `getKey()` function to use `KEYLIST_PATH`

2. **src/mcp.ts**
   - Fixed port argument parsing to handle undefined case properly

## Verification

Both fixes have been verified:

1. ✅ MCP server test passes successfully
2. ✅ Server initializes and lists tools correctly
3. ✅ TypeScript compilation succeeds (dependency warnings are unrelated)

## Testing

Run the test script to verify:
```bash
bun test-mcp.ts
```

Expected output:
```
✓ MCP server is working correctly!
```

## Next Steps

The MCP server is now ready for production use. You can:

1. Start the server in stdio mode: `bun run mcp`
2. Start the server in SSE mode: `bun run mcp:sse`
3. Configure Claude Desktop to use this MCP server
4. Test the actual tool calls (pull_stock_prices and pull_news)
