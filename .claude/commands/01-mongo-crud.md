---
model: sonnet
description: Create MongoDB CRUD utility with TypeScript
argument-hint: (no arguments needed)
---

## Variables

None

## Instructions

Create a TypeScript utility module for MongoDB operations according to the specification below.

### File Structure

Create the following files:
```
src/
├── mongo.ts           # Main MongoDB utility module
└── mongo.test.ts      # Test script for all functions
```

### Environment Configuration

Use `MONGODB_CONNECTION_STRING` environment variable from `.env` file for MongoDB connection.

### API Specification for `src/mongo.ts`

#### Connection Management

**`connect(): Promise<MongoClient>`**
- Establishes connection to MongoDB using `MONGODB_CONNECTION_STRING` from environment
- Returns the connected `MongoClient` instance
- Throws error if connection fails or `MONGODB_CONNECTION_STRING` is not defined
- Prefix connection string with `mongodb://` if not already present

**`disconnect(client: MongoClient): Promise<void>`**
- Closes the MongoDB connection gracefully

#### Collection Operations

**`listCollections(db: string): Promise<string[]>`**
- Lists all collection names in the specified database
- Returns: Array of collection names

**`createCollection(db: string, collection: string): Promise<void>`**
- Creates a new collection in the specified database
- Throws error if collection already exists

**`removeCollection(db: string, collection: string): Promise<boolean>`**
- Drops/removes a collection from the specified database
- Returns: `true` if collection was dropped, `false` if collection didn't exist

#### Document Operations

**`listDocuments<T = Document>(db: string, collection: string): Promise<T[]>`**
- Retrieves all documents from a collection
- Generic type `T` allows for typed document results

**`findDocuments<T = Document>(db: string, collection: string, filter: Record<string, any>, options?: { sort?: Record<string, 1 | -1>; limit?: number }): Promise<T[]>`**
- Queries documents matching the filter with optional sorting and limit
- `filter`: MongoDB query filter object (e.g., `{ date: "2025-12-23" }`)
- `options.sort`: Sort order object (e.g., `{ date: -1 }` for descending)
- `options.limit`: Maximum number of documents to return
- Returns: Array of matching documents
- This is a more flexible alternative to `listDocuments` that supports filtering and sorting

**`createDocument<T = Document>(db: string, collection: string, doc: T): Promise<string>`**
- Inserts a new document into the collection
- Returns: The inserted document's `_id` as a string

**`updateDocument<T = Partial<Document>>(db: string, collection: string, id: string, doc: T): Promise<boolean>`**
- **CRITICAL**: Performs an incremental/partial update using MongoDB's `$set` operator
- Only updates the fields provided in `doc`, preserving all other existing fields
- Converts `id` string to `ObjectId`
- Returns: `true` if a document was modified, `false` otherwise

**`deleteDocument(db: string, collection: string, id: string): Promise<boolean>`**
- Deletes a document by its `_id`
- Converts `id` string to `ObjectId`
- Returns: `true` if a document was deleted, `false` if not found

### Implementation Requirements

1. **ObjectId Conversion**: All `id` parameters are strings and must be converted to `ObjectId` using `new ObjectId(id)` from the mongodb package
2. **Error Handling**: All functions should throw descriptive errors for invalid inputs or operation failures
3. **Type Safety**: Export all functions with proper TypeScript types
4. **Connection String**: Ensure the connection string is properly formatted with `mongodb://` prefix

### Test Script Specification for `src/mongo.test.ts`

Use `bun test` framework with the following test structure:

```typescript
import { test, expect, beforeAll, afterAll, describe } from "bun:test";
```

#### Test Configuration
- Use test database: `test_mongo_crud`
- Use test collection: `test_collection`
- Clean up test data in `afterAll` hook
- Each test should be independent

#### Test Cases

**Connection Tests**
- `test("should connect successfully")` - Verify connect() returns valid MongoClient
- `test("should disconnect successfully")` - Verify disconnect() closes without error

**Collection Tests**
- `test("should create a collection")` - Create collection and verify it exists
- `test("should list collections")` - Verify listCollections() returns array containing test collection
- `test("should remove a collection")` - Remove collection and verify it no longer exists

**Document Tests**
- `test("should create a document")` - Create document with `{ name: "Test", value: 42, extra: "data" }` and verify ID is returned
- `test("should list documents")` - Verify created document exists in listing
- `test("should find documents with filter")` - Use findDocuments with filter `{ name: "Test" }` and verify it returns the document
- `test("should find documents with sort and limit")` - Create multiple documents and use findDocuments with sort and limit options
- `test("should update a document incrementally")` - Update with `{ value: 100 }` and verify success
- `test("should verify incremental update preserves other fields")` - Verify that after update, `name` and `extra` fields are still present and unchanged
- `test("should delete a document")` - Delete document and verify it no longer exists

### Example Usage Pattern

```typescript
// Connect
const client = await connect();

try {
  // Create collection
  await createCollection("mydb", "users");

  // Create document
  const userId = await createDocument("mydb", "users", {
    name: "Alice",
    email: "alice@example.com",
    age: 30
  });

  // Incremental update - only age changes
  await updateDocument("mydb", "users", userId, {
    age: 31  // name and email are preserved
  });

  // List all documents
  const users = await listDocuments("mydb", "users");

  // Find documents with filter and options
  const olderUsers = await findDocuments("mydb", "users",
    { age: { $gte: 30 } },
    { sort: { age: -1 }, limit: 10 }
  );

  // Delete
  await deleteDocument("mydb", "users", userId);

  // Remove collection
  await removeCollection("mydb", "users");

} finally {
  await disconnect(client);
}
```

### Implementation Steps

1. Create `src/` directory if it doesn't exist
2. Implement `src/mongo.ts` with all functions following the specification
3. Implement `src/mongo.test.ts` with comprehensive test coverage
4. Run tests with `bun test src/mongo.test.ts` to verify all functions work correctly
5. Ensure all tests pass before completing
