# Setting Up .keylist for Auto-Pull Feature

## Quick Setup

The auto-pull feature requires a `.keylist` file containing your Alpha Vantage API key(s).

### Step 1: Get an Alpha Vantage API Key

1. Visit: https://www.alphavantage.co/support/#api-key
2. Enter your email and click "GET FREE API KEY"
3. Copy the API key you receive

### Step 2: Create .keylist File

Create a file named `.keylist` in the project root:

```bash
# Option 1: Using echo
echo "YOUR_API_KEY_HERE" > .keylist

# Option 2: Using a text editor
nano .keylist
# Or use any editor: vim, code, etc.
```

### Step 3: Add Your API Key(s)

The `.keylist` file should contain one API key per line:

**Single Key:**
```
ABCDEFGHIJ1234567890
```

**Multiple Keys (for rate limit rotation):**
```
ABCDEFGHIJ1234567890
KLMNOPQRST0987654321
UVWXYZABCD1122334455
```

### Step 4: Secure the File

The `.keylist` file should NOT be committed to git (it's already in `.gitignore`):

```bash
# Verify it's gitignored
git status
# .keylist should NOT appear in the list

# Set restrictive permissions (optional but recommended)
chmod 600 .keylist
```

### Step 5: Verify Setup

Test that the auto-pull feature works:

```bash
# Method 1: Using the CLI
bun src/run-stocks.ts --pull-stock MSFT

# Method 2: Using the MCP server (will auto-pull if data missing)
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_stock_prices", "arguments": {"symbol": "MSFT"}}, "id": 1}' | bun src/mcp.ts --stdio
```

## File Format

### Correct Format ✅
```
ABC123DEF456GHI789
XYZ987UVW654RST321
```

### Incorrect Formats ❌

**Has extra whitespace:**
```
  ABC123DEF456GHI789
```

**Has comments:**
```
ABC123DEF456GHI789  # My API key
```

**Has labels:**
```
api_key=ABC123DEF456GHI789
```

**Empty lines between keys:**
```
ABC123DEF456GHI789

XYZ987UVW654RST321
```

The file should contain ONLY the API keys, one per line, with no extra whitespace or characters.

## Troubleshooting

### Error: "ENOENT: no such file or directory, open '.keylist'"

**Problem:** The `.keylist` file doesn't exist.

**Solution:**
```bash
# Create the file
echo "YOUR_API_KEY" > .keylist
```

### Error: ".keylist file is empty"

**Problem:** The file exists but has no content.

**Solution:**
```bash
# Add your API key
echo "YOUR_API_KEY" > .keylist
```

### Error: "Alpha Vantage API error: Invalid API call..."

**Problem:** Invalid API key or rate limit exceeded.

**Solutions:**
1. Verify your API key is correct
2. Check for rate limits (5 API calls per minute for free tier)
3. Add multiple keys to `.keylist` for rotation

### Auto-Pull Not Working

**Symptoms:** Getting "No stock data found" without auto-pull attempt.

**Debugging:**
```bash
# Check if .keylist exists
ls -la .keylist

# Check file contents (first few characters)
head -c 10 .keylist

# Check file permissions
ls -l .keylist

# Test API key manually
bun src/run-stocks.ts --pull-stock TEST
```

## API Rate Limits

Alpha Vantage free tier limits:
- **5 API calls per minute**
- **500 API calls per day**

The auto-pull feature:
- Waits 5 seconds after each API call
- Rotates through multiple keys if provided
- Pulls ~100 days of data per call

## Multiple Keys for Rate Limiting

If you have multiple API keys, add them all to `.keylist`:

```
KEY_1_ABC123
KEY_2_DEF456
KEY_3_GHI789
```

The system will rotate through them in round-robin fashion, effectively multiplying your rate limit.

## Security Best Practices

1. **Never commit .keylist to git** (already in .gitignore)
2. **Set restrictive permissions:** `chmod 600 .keylist`
3. **Don't share your API keys**
4. **Rotate keys if exposed**
5. **Use environment variables in production:**
   ```bash
   # For production, use environment variables instead
   export ALPHA_VANTAGE_API_KEY="your-key"
   ```

## Example Complete Setup

```bash
# 1. Navigate to project root
cd /path/to/alphavantage

# 2. Create .keylist file
cat > .keylist << 'EOF'
ABC123DEF456GHI789JKL012
EOF

# 3. Secure the file
chmod 600 .keylist

# 4. Verify it's gitignored
git status | grep keylist
# Should show nothing (file is ignored)

# 5. Test it works
bun src/run-stocks.ts --pull-stock AAPL

# 6. Test with MCP server
bun run verify
```

## Alternative: Manual Pull (Without .keylist)

If you don't want to set up auto-pull, you can still use the MCP server with manually pulled data:

```bash
# Manually pull data for stocks you want to query
bun src/run-stocks.ts --pull-stock AAPL
bun src/run-stocks.ts --pull-stock MSFT
bun src/run-stocks.ts --pull-stock GOOGL

# Then query via MCP (no auto-pull, uses cached data)
# Will work fine for these symbols
```

The MCP server will gracefully handle missing data by showing a helpful error message with instructions.
