# Error Handling Update for Auto-Pull Feature

## Issue

When the auto-pull feature tried to fetch data but the `.keylist` file was missing, it would fail with an unhelpful error:

```
Error: ENOENT: no such file or directory, open '.keylist'
```

## Solution

Added comprehensive error handling with helpful, actionable error messages.

## Changes Made

### Code Updates (`src/mcp.ts`)

Wrapped the `pullStock()` calls in try-catch blocks:

```typescript
try {
  console.error(`Stock data not found for ${symbol}, pulling from Alpha Vantage API...`);
  const count = await pullStock(symbol);
  console.error(`Pulled ${count} records for ${symbol}`);

  // ... query and return data

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
```

## Error Messages

### Before
```json
{
  "error": "Error: ENOENT: no such file or directory, open '.keylist'"
}
```

Users would see a cryptic file system error with no guidance on how to fix it.

### After

**Missing .keylist file:**
```json
{
  "message": "No stock data found for MSFT. Auto-pull failed: .keylist file not found. Please create a .keylist file with your Alpha Vantage API key(s), or manually pull the data using: bun src/run-stocks.ts --pull-stock MSFT",
  "data": null,
  "error": "Missing .keylist file"
}
```

**Other API errors:**
```json
{
  "message": "No stock data found for INVALID. Auto-pull failed: Invalid API call. Please retry or visit the documentation (https://www.alphavantage.co/support/) for further assistance.",
  "data": null,
  "error": "Invalid API call..."
}
```

## Benefits

### 1. **Clear Error Messages**
Users immediately understand what went wrong and what they need to do.

### 2. **Actionable Guidance**
Error messages include:
- What the problem is (.keylist file missing)
- How to fix it (create the file with API keys)
- Alternative solution (manual pull command)

### 3. **Graceful Degradation**
The MCP server doesn't crash - it returns a helpful error response that clients can display.

### 4. **Multiple Error Types Handled**
- Missing .keylist file
- Empty .keylist file
- Invalid API keys
- Rate limit errors
- Network errors
- Any other unexpected errors

## User Experience

### Scenario 1: Missing .keylist File

**User Action:**
```bash
# Query a stock that's not in MongoDB
get_stock_prices(symbol="TSLA")
```

**Server Response:**
```
No stock data found for TSLA. Auto-pull failed: .keylist file not found.
Please create a .keylist file with your Alpha Vantage API key(s),
or manually pull the data using: bun src/run-stocks.ts --pull-stock TSLA
```

**User follows instructions:**
```bash
# Option 1: Create .keylist and retry
echo "MY_API_KEY" > .keylist
get_stock_prices(symbol="TSLA")  # Works now!

# Option 2: Manual pull
bun src/run-stocks.ts --pull-stock TSLA
get_stock_prices(symbol="TSLA")  # Works!
```

### Scenario 2: Invalid API Key

**Server Response:**
```
No stock data found for TSLA. Auto-pull failed: Invalid API call.
Please retry or visit the documentation (https://www.alphavantage.co/support/)
for further assistance.
```

User knows to check their API key in `.keylist`.

## Documentation Updates

### Created: SETUP-KEYLIST.md
Comprehensive guide covering:
- How to get an API key
- How to create .keylist file
- File format requirements
- Troubleshooting common errors
- Security best practices
- Alternative manual pull approach

### Updated: MCP-SERVER-README.md
- Marked .keylist as "Optional"
- Added link to SETUP-KEYLIST.md
- Added notes about graceful degradation
- Documented manual pull alternative

## Testing

### Test Case 1: Missing .keylist
```bash
# Remove .keylist if it exists
rm .keylist

# Query unknown stock
bun verify-mcp.ts

# Expected: Helpful error message, not crash
```

### Test Case 2: With .keylist
```bash
# Create .keylist
echo "YOUR_KEY" > .keylist

# Query unknown stock
# Expected: Auto-pulls successfully
```

## Implementation Details

### Error Detection Strategy

1. **Catch all errors** from `pullStock()`
2. **Inspect error message** for known patterns:
   - `.keylist` keyword → Missing keylist file
   - `ENOENT` → File not found error
   - Other messages → Generic API/network errors
3. **Return structured response** with:
   - User-friendly message
   - Null/empty data
   - Error category for logging

### Error Response Structure

```typescript
{
  message: string,    // User-facing explanation + guidance
  data: null | [],    // Empty data (appropriate for the query type)
  error: string       // Error category for debugging/logging
}
```

## Backwards Compatibility

✅ Fully backwards compatible:
- Existing queries still work the same
- Success responses unchanged
- Only adds better error handling
- No breaking changes to API

## Security Considerations

Error messages:
- ✅ Don't expose sensitive data
- ✅ Don't reveal API keys
- ✅ Don't show internal file paths (beyond .keylist)
- ✅ Provide guidance without over-sharing

## Future Improvements

Potential enhancements:
1. Check for `.keylist` existence before attempting pull
2. Validate API key format before calling API
3. Cache error states to avoid repeated failed pulls
4. Add retry logic with exponential backoff
5. Support environment variable fallback (ALPHA_VANTAGE_API_KEY)

## Summary

The error handling update transforms the auto-pull feature from fragile (crashes on missing file) to robust (gracefully handles errors with helpful messages).

**Key improvements:**
- ✅ No more cryptic ENOENT errors
- ✅ Clear, actionable error messages
- ✅ Graceful degradation (server keeps working)
- ✅ Multiple solutions provided (auto-pull or manual)
- ✅ Comprehensive documentation
- ✅ Better user experience

The MCP server is now production-ready with proper error handling! 🎉
