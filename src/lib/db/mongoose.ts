import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI!;

if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI is not defined');
}

// TypeScript global cache for Next.js hot reload
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Extend Node.js global object
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Create global cache if it doesn't exist
const globalCache = global.mongooseCache ?? (global.mongooseCache = { conn: null, promise: null });

/**
 * Connects to MongoDB (singleton)
 */
export async function connectMongoose() {
  // Return existing connection if already connected
  if (globalCache.conn) {
    return globalCache.conn;
  }

  // If there is no connection promise, create one
  if (!globalCache.promise) {
    console.log('🟢 Connecting to MongoDB...');
    globalCache.promise = mongoose.connect(MONGO_URI, {
      bufferCommands: false, // don't buffer commands if not connected
    });
  }

  // Await the connection promise and store the connection
  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
