import { MongoClient, ObjectId, type Document } from "mongodb";

let globalClient: MongoClient | null = null;

/**
 * Establishes connection to MongoDB using MONGODB_CONNECTION_STRING from environment
 * @returns The connected MongoClient instance
 * @throws Error if connection fails or MONGODB_CONNECTION_STRING is not defined
 */
export async function connect(): Promise<MongoClient> {
  let connectionString = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING environment variable is not defined");
  }

  // Prefix connection string with mongodb:// if not already present
  if (!connectionString.startsWith("mongodb://") && !connectionString.startsWith("mongodb+srv://")) {
    connectionString = `mongodb://${connectionString}`;
  }

  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    globalClient = client;
    return client;
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Closes the MongoDB connection gracefully
 * @param client The MongoClient instance to disconnect
 */
export async function disconnect(client: MongoClient): Promise<void> {
  await client.close();
  if (globalClient === client) {
    globalClient = null;
  }
}

/**
 * Lists all collection names in the specified database
 * @param db Database name
 * @returns Array of collection names
 */
export async function listCollections(db: string): Promise<string[]> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const collections = await database.listCollections().toArray();
  return collections.map(col => col.name);
}

/**
 * Creates a new collection in the specified database
 * @param db Database name
 * @param collection Collection name
 * @throws Error if collection already exists
 */
export async function createCollection(db: string, collection: string): Promise<void> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const collections = await listCollections(db);

  if (collections.includes(collection)) {
    throw new Error(`Collection '${collection}' already exists in database '${db}'`);
  }

  await database.createCollection(collection);
}

/**
 * Drops/removes a collection from the specified database
 * @param db Database name
 * @param collection Collection name
 * @returns true if collection was dropped, false if collection didn't exist
 */
export async function removeCollection(db: string, collection: string): Promise<boolean> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const collections = await listCollections(db);

  if (!collections.includes(collection)) {
    return false;
  }

  await database.collection(collection).drop();
  return true;
}

/**
 * Retrieves all documents from a collection
 * @param db Database name
 * @param collection Collection name
 * @returns Array of documents
 */
export async function listDocuments<T extends Document = Document>(db: string, collection: string): Promise<T[]> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection<T>(collection);
  return await col.find({}).toArray() as T[];
}

/**
 * Queries documents matching the filter with optional sorting and limit
 * @param db Database name
 * @param collection Collection name
 * @param filter Query filter object
 * @param options Optional sort and limit parameters
 * @returns Array of matching documents
 */
export async function findDocuments<T = Document>(
  db: string,
  collection: string,
  filter: Record<string, any>,
  options?: { sort?: Record<string, 1 | -1>; limit?: number }
): Promise<T[]> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection(collection);

  let cursor = col.find(filter);

  if (options?.sort) {
    cursor = cursor.sort(options.sort);
  }

  if (options?.limit) {
    cursor = cursor.limit(options.limit);
  }

  return await cursor.toArray() as T[];
}

/**
 * Inserts a new document into the collection
 * @param db Database name
 * @param collection Collection name
 * @param doc Document to insert
 * @returns The inserted document's _id as a string
 */
export async function createDocument<T extends Document = Document>(db: string, collection: string, doc: T): Promise<string> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection<T>(collection);
  const result = await col.insertOne(doc as any);
  return result.insertedId.toString();
}

/**
 * Performs an incremental/partial update using MongoDB's $set operator
 * Only updates the fields provided in doc, preserving all other existing fields
 * @param db Database name
 * @param collection Collection name
 * @param id Document ID as string
 * @param doc Partial document with fields to update
 * @returns true if a document was modified, false otherwise
 */
export async function updateDocument<T extends Partial<Document> = Partial<Document>>(
  db: string,
  collection: string,
  id: string,
  doc: T
): Promise<boolean> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection(collection);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch (error) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }

  const result = await col.updateOne(
    { _id: objectId },
    { $set: doc }
  );

  return result.modifiedCount > 0;
}

/**
 * Deletes a document by its _id
 * @param db Database name
 * @param collection Collection name
 * @param id Document ID as string
 * @returns true if a document was deleted, false if not found
 */
export async function deleteDocument(db: string, collection: string, id: string): Promise<boolean> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection(collection);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch (error) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }

  const result = await col.deleteOne({ _id: objectId });
  return result.deletedCount > 0;
}

/**
 * Upserts a document using replaceOne with upsert: true
 * If a document matching the filter exists, it will be replaced entirely with doc
 * If no document matches the filter, a new document will be inserted
 * @param db Database name
 * @param collection Collection name
 * @param filter Filter to match existing documents
 * @param doc Document to insert or replace with
 * @returns true if a document was inserted or replaced
 */
export async function upsertDocument<T = Document>(
  db: string,
  collection: string,
  filter: Record<string, any>,
  doc: T
): Promise<boolean> {
  if (!globalClient) {
    throw new Error("Not connected to MongoDB. Call connect() first.");
  }

  const database = globalClient.db(db);
  const col = database.collection(collection);

  const result = await col.replaceOne(filter, doc as any, { upsert: true });
  return result.acknowledged;
}
