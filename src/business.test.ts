import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { connect, disconnect, listDocuments, removeCollection } from "./mongo";
import { getKey, pullStock, pullNews } from "./business";
import type { MongoClient } from "mongodb";
import type { StockData, NewsItem } from "./business";

let client: MongoClient;

beforeAll(async () => {
  client = await connect();
});

afterAll(async () => {
  // Clean up test data
  try {
    await removeCollection("finance", "stock-IBM");
    await removeCollection("finance", "news");
  } catch (error) {
    // Ignore errors if collections don't exist
  }

  await disconnect(client);
});

// ============================================================================
// Key Management Tests
// ============================================================================

describe("Key Management", () => {
  test("should read keys from .keylist file", async () => {
    const key = await getKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  test("should rotate keys in round-robin fashion", async () => {
    // Read the .keylist file to know how many keys we have
    const file = Bun.file(".keylist");
    const content = await file.text();
    const keys = content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Get keys and verify rotation
    const firstKey = await getKey();
    const secondKey = await getKey();

    // If we have more than one key, they should be different
    if (keys.length > 1) {
      expect(firstKey).not.toBe(secondKey);
    }

    // After getting all keys, should wrap around to first key
    const receivedKeys = [firstKey, secondKey];
    for (let i = 2; i < keys.length; i++) {
      receivedKeys.push(await getKey());
    }

    // Next key should be the first key again (wrap around)
    const wrappedKey = await getKey();
    expect(wrappedKey).toBe(firstKey);
  });

  test("should wrap around to first key after last key", async () => {
    // Read keys to determine the count
    const file = Bun.file(".keylist");
    const content = await file.text();
    const keys = content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Get first key
    const firstKey = await getKey();

    // Get keys until we wrap around
    for (let i = 1; i < keys.length; i++) {
      await getKey();
    }

    // Next key should be the first key (wrapped)
    const wrappedKey = await getKey();
    expect(wrappedKey).toBe(firstKey);
  });
});

// ============================================================================
// Stock Data Tests
// ============================================================================

describe("Stock Data Operations", () => {
  test(
    "should pull stock data for a symbol",
    async () => {
      const count = await pullStock("IBM");
      expect(count).toBeGreaterThan(0);
      console.log(`Pulled ${count} stock records for IBM`);
    },
    { timeout: 30000 }
  );

  test("should save stock documents to MongoDB", async () => {
    const documents = await listDocuments<StockData>("finance", "stock-IBM");
    expect(documents.length).toBeGreaterThan(0);
    console.log(`Found ${documents.length} documents in stock-IBM collection`);
  });

  test("should parse stock data correctly", async () => {
    const documents = await listDocuments<StockData>("finance", "stock-IBM");
    expect(documents.length).toBeGreaterThan(0);

    const doc = documents[0];
    expect(doc.symbol).toBe("IBM");
    expect(typeof doc.date).toBe("string");
    expect(typeof doc.open).toBe("number");
    expect(typeof doc.high).toBe("number");
    expect(typeof doc.low).toBe("number");
    expect(typeof doc.close).toBe("number");
    expect(typeof doc.volume).toBe("number");

    console.log("Sample stock document:", {
      symbol: doc.symbol,
      date: doc.date,
      open: doc.open,
      high: doc.high,
      low: doc.low,
      close: doc.close,
      volume: doc.volume,
    });
  });

  test(
    "should replace existing stock document on re-pull",
    async () => {
      // Get initial count
      const initialDocs = await listDocuments<StockData>("finance", "stock-IBM");
      const initialCount = initialDocs.length;
      expect(initialCount).toBeGreaterThan(0);

      // Pull again
      const count = await pullStock("IBM");
      expect(count).toBeGreaterThan(0);

      // Verify count stays the same (no duplicates)
      const finalDocs = await listDocuments<StockData>("finance", "stock-IBM");
      expect(finalDocs.length).toBe(initialCount);

      // Verify date field is unique
      const dates = finalDocs.map(doc => doc.date);
      const uniqueDates = new Set(dates);
      expect(uniqueDates.size).toBe(dates.length);

      console.log(`Verified no duplicates: ${finalDocs.length} documents, ${uniqueDates.size} unique dates`);
    },
    { timeout: 30000 }
  );
});

// ============================================================================
// News Sentiment Tests
// ============================================================================

describe("News Sentiment Operations", () => {
  test(
    "should pull news data for a time range",
    async () => {
      const count = await pullNews("20251221T0000", "20251222T0000");
      expect(count).toBeGreaterThan(0);
      console.log(`Pulled ${count} news articles`);
    },
    { timeout: 30000 }
  );

  test("should save news documents to MongoDB", async () => {
    const documents = await listDocuments<NewsItem>("finance", "news");
    expect(documents.length).toBeGreaterThan(0);
    console.log(`Found ${documents.length} documents in news collection`);
  });

  test("should parse news data correctly", async () => {
    const documents = await listDocuments<NewsItem>("finance", "news");
    expect(documents.length).toBeGreaterThan(0);

    const doc = documents[0];
    expect(typeof doc.title).toBe("string");
    expect(typeof doc.url).toBe("string");
    expect(typeof doc.time_published).toBe("string");
    expect(Array.isArray(doc.authors)).toBe(true);
    expect(typeof doc.summary).toBe("string");
    expect(typeof doc.source).toBe("string");
    expect(typeof doc.category_within_source).toBe("string");
    expect(typeof doc.source_domain).toBe("string");
    expect(Array.isArray(doc.topics)).toBe(true);
    expect(typeof doc.overall_sentiment_score).toBe("number");
    expect(typeof doc.overall_sentiment_label).toBe("string");
    expect(Array.isArray(doc.ticker_sentiment)).toBe(true);

    console.log("Sample news document:", {
      title: doc.title.substring(0, 50) + "...",
      time_published: doc.time_published,
      source: doc.source,
      overall_sentiment_label: doc.overall_sentiment_label,
    });
  });

  test(
    "should replace existing news document on re-pull",
    async () => {
      // Get initial count
      const initialDocs = await listDocuments<NewsItem>("finance", "news");
      const initialCount = initialDocs.length;
      expect(initialCount).toBeGreaterThan(0);

      // Pull again
      const count = await pullNews("20251221T0000", "20251222T0000");
      expect(count).toBeGreaterThan(0);

      // Verify count stays the same (no duplicates)
      const finalDocs = await listDocuments<NewsItem>("finance", "news");
      expect(finalDocs.length).toBe(initialCount);

      // Verify time_published field is unique
      const times = finalDocs.map(doc => doc.time_published);
      const uniqueTimes = new Set(times);
      expect(uniqueTimes.size).toBe(times.length);

      console.log(`Verified no duplicates: ${finalDocs.length} documents, ${uniqueTimes.size} unique timestamps`);
    },
    { timeout: 30000 }
  );
});
