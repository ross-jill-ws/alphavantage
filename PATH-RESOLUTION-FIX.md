# Path Resolution Fix for .keylist File

## Issue

The `.keylist` file was being referenced using a relative path (`.keylist`), which failed when the MCP server was started from a directory other than the project root.

### Error Observed
```json
{
  "message": "No stock data found for AUDUSD. Auto-pull failed: .keylist file not found...",
  "data": null,
  "error": "Missing .keylist file"
}
```

Even though `.keylist` existed in the project root, the code couldn't find it when running from different directories.

### Root Cause

**Before:**
```typescript
// In src/business.ts
const file = Bun.file(".keylist");  // ❌ Relative to current working directory
```

This looked for `.keylist` relative to `process.cwd()`, which could be:
- `/Users/user/alphavantage/` (works ✓)
- `/tmp/` (fails ✗)
- `/Users/user/alphavantage/src/` (fails ✗)
- Any other directory from which the MCP server was started

## Solution

Use absolute path resolution based on the source file location.

### Code Changes

**File:** `src/business.ts`

Added path resolution at the top of the file:

```typescript
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this source file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Project root is one level up from src/
const PROJECT_ROOT = path.resolve(__dirname, "..");
```

Updated `getKey()` function:

```typescript
export async function getKey(): Promise<string> {
  if (apiKeys.length === 0) {
    try {
      // ✓ Use absolute path to .keylist file in project root
      const keylistPath = path.join(PROJECT_ROOT, ".keylist");
      const file = Bun.file(keylistPath);
      // ... rest of the code
    }
  }
}
```

## How It Works

1. **Get source file location:**
   - `import.meta.url` → `file:///Users/user/alphavantage/src/business.ts`
   - `fileURLToPath()` → `/Users/user/alphavantage/src/business.ts`
   - `path.dirname()` → `/Users/user/alphavantage/src`

2. **Resolve project root:**
   - `path.resolve(__dirname, "..")` → `/Users/user/alphavantage`

3. **Build absolute path:**
   - `path.join(PROJECT_ROOT, ".keylist")` → `/Users/user/alphavantage/.keylist`

4. **Always finds the file:**
   - Regardless of where the MCP server is started from
   - Always looks in the correct project root

## Testing

### Test Script: `test-keylist-path.ts`

Tests `.keylist` can be found from different working directories:

```bash
bun test-keylist-path.ts
```

**Test Results:**
```
✓ Test 1: From project root - Success
✓ Test 2: From /tmp directory - Success
✓ Test 3: From src directory - Success
```

### Real-World Test

**Start MCP server from different directories:**

```bash
# From project root
cd /Users/user/alphavantage
bun src/mcp.ts --stdio
# ✓ Works - finds .keylist

# From /tmp
cd /tmp
bun /Users/user/alphavantage/src/mcp.ts --stdio
# ✓ Works - finds .keylist

# From src directory
cd /Users/user/alphavantage/src
bun mcp.ts --stdio
# ✓ Works - finds .keylist
```

## Benefits

### 1. **Location-Independent**
MCP server works regardless of where it's started from.

### 2. **Deployment-Friendly**
No need to ensure specific working directory in:
- Systemd services
- Docker containers
- CI/CD pipelines
- Shell scripts

### 3. **Developer Experience**
Developers can start the server from any directory:
```bash
# All of these work now:
bun src/mcp.ts --stdio
cd src && bun mcp.ts --stdio
cd /tmp && bun ~/alphavantage/src/mcp.ts --stdio
```

### 4. **Consistent Behavior**
`.keylist` is always expected in the project root, no matter where the code runs.

## File Locations

The fix ensures these files are always found in the project root:

```
alphavantage/
├── .keylist          ← Always found here
├── .env              ← Could apply same fix if needed
├── src/
│   ├── business.ts   ← Resolves path from here
│   └── mcp.ts        ← Uses business.ts
└── ...
```

## Backwards Compatibility

✅ Fully backwards compatible:
- Existing setups continue to work
- No changes needed to `.keylist` file location
- No changes needed to environment variables
- Only improves robustness

## Other Files to Consider

If similar issues occur with other files, apply the same pattern:

### Example: .env file
```typescript
// If you need to read .env explicitly
const envPath = path.join(PROJECT_ROOT, ".env");
```

### Example: Config files
```typescript
const configPath = path.join(PROJECT_ROOT, "config.json");
```

## Implementation Pattern

**Standard pattern for project-root files in src/**:

```typescript
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Use PROJECT_ROOT for all project-root files
const somePath = path.join(PROJECT_ROOT, "some-file.txt");
```

## Error Messages Update

The error message now shows the resolved path for debugging:

**Before:**
```
.keylist file not found
```

**After (could enhance further):**
```
.keylist file not found at: /Users/user/alphavantage/.keylist
```

This would help users verify the path is correct.

## Summary

**What changed:**
- ✅ Added path resolution imports to `src/business.ts`
- ✅ Defined `PROJECT_ROOT` constant
- ✅ Updated `getKey()` to use absolute path
- ✅ Tested from multiple working directories

**Impact:**
- ✅ MCP server now works from any directory
- ✅ More robust in production environments
- ✅ Better developer experience
- ✅ No breaking changes

The `.keylist` file will now be found reliably, regardless of where the MCP server is started! 🎉
