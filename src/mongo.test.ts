import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import type { MongoClient } from "mongodb";
import {
  connect,
  disconnect,
  listCollections,
  createCollection,
  removeCollection,
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "./mongo";

const TEST_DB = "test_mongo_crud";
const TEST_COLLECTION = "test_collection";

let client: MongoClient;
let testDocumentId: string;

beforeAll(async () => {
  client = await connect();
});

afterAll(async () => {
  // Clean up test data
  try {
    await removeCollection(TEST_DB, TEST_COLLECTION);
  } catch (error) {
    // Collection might not exist, ignore
  }
  await disconnect(client);
});

describe("Connection Tests", () => {
  test("should connect successfully", async () => {
    expect(client).toBeDefined();
    expect(client).toHaveProperty("db");
  });

  test("should disconnect successfully", async () => {
    // We'll test this in afterAll, but verify the function exists
    expect(disconnect).toBeDefined();
    expect(typeof disconnect).toBe("function");
  });
});

describe("Collection Tests", () => {
  test("should create a collection", async () => {
    // Remove collection if it exists from previous test run
    await removeCollection(TEST_DB, TEST_COLLECTION);

    await createCollection(TEST_DB, TEST_COLLECTION);
    const collections = await listCollections(TEST_DB);
    expect(collections).toContain(TEST_COLLECTION);
  });

  test("should list collections", async () => {
    const collections = await listCollections(TEST_DB);
    expect(Array.isArray(collections)).toBe(true);
    expect(collections).toContain(TEST_COLLECTION);
  });

  test("should remove a collection", async () => {
    // Create a temporary collection for removal test
    const tempCollection = "temp_test_collection";
    await createCollection(TEST_DB, tempCollection);

    const removed = await removeCollection(TEST_DB, tempCollection);
    expect(removed).toBe(true);

    const collections = await listCollections(TEST_DB);
    expect(collections).not.toContain(tempCollection);

    // Try removing non-existent collection
    const removedAgain = await removeCollection(TEST_DB, tempCollection);
    expect(removedAgain).toBe(false);
  });
});

describe("Document Tests", () => {
  test("should create a document", async () => {
    // Ensure collection exists
    const collections = await listCollections(TEST_DB);
    if (!collections.includes(TEST_COLLECTION)) {
      await createCollection(TEST_DB, TEST_COLLECTION);
    }

    const testDoc = {
      name: "Test",
      value: 42,
      extra: "data",
    };

    testDocumentId = await createDocument(TEST_DB, TEST_COLLECTION, testDoc);
    expect(testDocumentId).toBeDefined();
    expect(typeof testDocumentId).toBe("string");
    expect(testDocumentId.length).toBeGreaterThan(0);
  });

  test("should list documents", async () => {
    const documents = await listDocuments(TEST_DB, TEST_COLLECTION);
    expect(Array.isArray(documents)).toBe(true);
    expect(documents.length).toBeGreaterThan(0);

    const createdDoc = documents.find((doc: any) => doc._id.toString() === testDocumentId);
    expect(createdDoc).toBeDefined();
    expect(createdDoc).toHaveProperty("name", "Test");
    expect(createdDoc).toHaveProperty("value", 42);
    expect(createdDoc).toHaveProperty("extra", "data");
  });

  test("should update a document incrementally", async () => {
    const updated = await updateDocument(TEST_DB, TEST_COLLECTION, testDocumentId, {
      value: 100,
    });
    expect(updated).toBe(true);
  });

  test("should verify incremental update preserves other fields", async () => {
    const documents = await listDocuments(TEST_DB, TEST_COLLECTION);
    const updatedDoc = documents.find((doc: any) => doc._id.toString() === testDocumentId);

    expect(updatedDoc).toBeDefined();
    expect(updatedDoc).toHaveProperty("name", "Test");
    expect(updatedDoc).toHaveProperty("value", 100);
    expect(updatedDoc).toHaveProperty("extra", "data");
  });

  test("should delete a document", async () => {
    const deleted = await deleteDocument(TEST_DB, TEST_COLLECTION, testDocumentId);
    expect(deleted).toBe(true);

    const documents = await listDocuments(TEST_DB, TEST_COLLECTION);
    const deletedDoc = documents.find((doc: any) => doc._id.toString() === testDocumentId);
    expect(deletedDoc).toBeUndefined();

    // Try deleting non-existent document
    const deletedAgain = await deleteDocument(TEST_DB, TEST_COLLECTION, testDocumentId);
    expect(deletedAgain).toBe(false);
  });
});
