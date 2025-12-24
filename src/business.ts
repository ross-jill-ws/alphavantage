import { upsertDocument } from "./mongo";

// ============================================================================
// Types
// ============================================================================

export interface StockData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerSentiment {
  ticker: string;
  relevance_score: string;
  ticker_sentiment_score: string;
  ticker_sentiment_label: string;
}

export interface Topic {
  topic: string;
  relevance_score: string;
}

export interface NewsItem {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  banner_image: string | null;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Topic[];
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment: TickerSentiment[];
}

// ============================================================================
// Key Management
// ============================================================================

let apiKeys: string[] = [];
let currentKeyIndex = 0;

/**
 * Reads API keys from .keylist file and returns the next key in round-robin rotation
 * @returns The next API key in the rotation
 * @throws Error if .keylist file is not found or empty
 */
export async function getKey(): Promise<string> {
  // Load keys from file if not already loaded
  if (apiKeys.length === 0) {
    try {
      const file = Bun.file(".keylist");
      const content = await file.text();
      apiKeys = content
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (apiKeys.length === 0) {
        throw new Error(".keylist file is empty");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("No such file")) {
        throw new Error(".keylist file not found");
      }
      throw error;
    }
  }

  // Get current key and advance index
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;

  return key as string;
}

/**
 * Waits for 5 seconds to respect API rate limits
 */
export async function waitAfterApiCall(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// ============================================================================
// Stock Data Operations
// ============================================================================

/**
 * Pulls stock data from Alpha Vantage TIME_SERIES_DAILY API and stores in MongoDB
 * @param symbol Stock symbol (e.g., "AAPL")
 * @returns Number of documents upserted
 * @throws Error if API call fails or response is invalid
 */
export async function pullStock(symbol: string): Promise<number> {
  const apiKey = await getKey();
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Failed to fetch stock data: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Failed to parse API response as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check for error response from Alpha Vantage
  if (data.Error || data["Error Message"]) {
    throw new Error(`Alpha Vantage API error: ${data.Error || data["Error Message"]}`);
  }

  // Extract time series data
  const timeSeries = data["Time Series (Daily)"];
  if (!timeSeries) {
    throw new Error("Invalid API response: missing 'Time Series (Daily)' field");
  }

  // Process each date entry
  let count = 0;
  const collectionName = `stock-${symbol}`;

  for (const [date, values] of Object.entries(timeSeries)) {
    const dailyData = values as any;

    const stockDoc: StockData = {
      symbol,
      date,
      open: parseFloat(dailyData["1. open"]),
      high: parseFloat(dailyData["2. high"]),
      low: parseFloat(dailyData["3. low"]),
      close: parseFloat(dailyData["4. close"]),
      volume: parseInt(dailyData["5. volume"], 10),
    };

    // Upsert document with date as unique key
    await upsertDocument("finance", collectionName, { date }, stockDoc);
    count++;
  }

  // Wait after API call to respect rate limits
  await waitAfterApiCall();

  return count;
}

// ============================================================================
// News Sentiment Operations
// ============================================================================

/**
 * Pulls news sentiment data from Alpha Vantage NEWS_SENTIMENT API and stores in MongoDB
 * @param time_from Start time in format YYYYMMDDTHHMM (e.g., "20251221T0000")
 * @param time_to End time in format YYYYMMDDTHHMM (e.g., "20251222T0000")
 * @returns Number of documents upserted
 * @throws Error if API call fails or response is invalid
 */
export async function pullNews(time_from: string, time_to: string): Promise<number> {
  const apiKey = await getKey();
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=1000&time_from=${time_from}&time_to=${time_to}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Failed to fetch news data: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Failed to parse API response as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check for error response from Alpha Vantage
  if (data.Error || data["Error Message"]) {
    throw new Error(`Alpha Vantage API error: ${data.Error || data["Error Message"]}`);
  }

  // Extract feed array
  const feed = data.feed;
  if (!feed || !Array.isArray(feed)) {
    throw new Error("Invalid API response: missing or invalid 'feed' field");
  }

  // Process each news item
  let count = 0;
  const collectionName = "news";

  for (const item of feed) {
    const newsDoc: NewsItem = {
      title: item.title,
      url: item.url,
      time_published: item.time_published,
      authors: item.authors || [],
      summary: item.summary,
      banner_image: item.banner_image || null,
      source: item.source,
      category_within_source: item.category_within_source,
      source_domain: item.source_domain,
      topics: item.topics || [],
      overall_sentiment_score: parseFloat(item.overall_sentiment_score),
      overall_sentiment_label: item.overall_sentiment_label,
      ticker_sentiment: item.ticker_sentiment || [],
    };

    // Upsert document with time_published as unique key
    await upsertDocument("finance", collectionName, { time_published: item.time_published }, newsDoc);
    count++;
  }

  // Wait after API call to respect rate limits
  await waitAfterApiCall();

  return count;
}
