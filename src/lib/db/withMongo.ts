import { connectMongoose } from "./mongoose";
import { NextResponse } from "next/server";

type Handler<T = any> = (...args: any[]) => Promise<T>;

/**
 * withMongo wrapper
 * - Connects MongoDB once (singleton)
 * - Wraps your handler with try/catch
 * - Returns NextResponse
 */
export function withMongo(handler: Handler) {
  return async (...args: Parameters<Handler>) => {
    try {
      // ✅ Ensure MongoDB connection
      await connectMongoose();
      // ✅ Call original handler
      const result = await handler(...args);

      // Return JSON response
      return NextResponse.json(result);
    } catch (err: any) {
      console.error("❌ Mongo Handler Error:", err);
      return NextResponse.json(
        { error: err.message || "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
