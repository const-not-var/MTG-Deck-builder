import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local")
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
}

const cache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cache

export async function connectDB() {
  if (cache.conn) return cache.conn

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB ?? "mtg-commander-builder" })
  }

  cache.conn = await cache.promise
  return cache.conn
}
