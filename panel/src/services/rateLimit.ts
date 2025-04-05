import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

interface RateLimit {
  ip: string;
  attempts: number;
  last_attempt: string;
}

export class RateLimitService {
  private db: ReturnType<typeof Database>;
  private maxAttempts = 100;
  private windowMs = 2 * 60 * 1000; // 2 minutes in milliseconds

  constructor() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), "data");
      fs.mkdirSync(dataDir, { recursive: true });

      const dbPath = path.join(dataDir, "ratelimit.db");
      this.db = new Database(dbPath);
      this.initTable();

      // Clean up old entries every hour
      setInterval(() => this.cleanupOldEntries(), 60 * 60 * 1000);
    } catch (error) {
      console.error("Rate limit service initialization failed:", error);
      throw error;
    }
  }

  private initTable() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip TEXT UNIQUE,
          attempts INTEGER DEFAULT 1,
          last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error("Error creating rate limit table:", error);
      throw error;
    }
  }

  private cleanupOldEntries() {
    try {
      const cutoffTime = new Date(Date.now() - this.windowMs).toISOString();
      this.db
        .prepare("DELETE FROM rate_limits WHERE last_attempt < ?")
        .run(cutoffTime);
    } catch (error) {
      console.error("Error cleaning up rate limits:", error);
    }
  }

  async checkRateLimit(
    ip: string
  ): Promise<{ allowed: boolean; remainingAttempts: number }> {
    try {
      const rateLimit = this.db
        .prepare("SELECT * FROM rate_limits WHERE ip = ?")
        .get(ip) as RateLimit | undefined;

      if (!rateLimit) {
        this.db
          .prepare(
            "INSERT INTO rate_limits (ip, attempts, last_attempt) VALUES (?, 1, CURRENT_TIMESTAMP)"
          )
          .run(ip);
        return { allowed: true, remainingAttempts: this.maxAttempts - 1 };
      }

      const timeDiff = Date.now() - new Date(rateLimit.last_attempt).getTime();

      if (timeDiff > this.windowMs) {
        this.db
          .prepare(
            "UPDATE rate_limits SET attempts = 1, last_attempt = CURRENT_TIMESTAMP WHERE ip = ?"
          )
          .run(ip);
        return { allowed: true, remainingAttempts: this.maxAttempts - 1 };
      }

      if (rateLimit.attempts >= this.maxAttempts) {
        return { allowed: false, remainingAttempts: 0 };
      }

      this.db
        .prepare(
          "UPDATE rate_limits SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE ip = ?"
        )
        .run(ip);

      return {
        allowed: true,
        remainingAttempts: this.maxAttempts - rateLimit.attempts - 1,
      };
    } catch (error) {
      console.error("Error checking rate limit:", error);
      // If there's an error, allow the request but log the error
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }
  }
}

export const rateLimitService = new RateLimitService();
