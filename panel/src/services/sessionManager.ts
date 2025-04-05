import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

interface Session {
  session_id: string;
  username: string;
  device_info: string;
  last_active: string;
}

export class SessionManager {
  private db: ReturnType<typeof Database>;

  constructor() {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), "data");
    fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = path.join(dataDir, "auth.db");
    this.db = new Database(dbPath);
    this.initSessionTable();
  }

  private initSessionTable() {
    this.db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS active_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE,
          username TEXT,
          device_info TEXT,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `
      )
      .run();
  }

  async createSession(username: string, deviceInfo: string): Promise<string> {
    const sessionId = uuidv4();
    this.db
      .prepare(
        "INSERT INTO active_sessions (session_id, username, device_info) VALUES (?, ?, ?)"
      )
      .run(sessionId, username, deviceInfo);
    return sessionId;
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = this.db
      .prepare("SELECT * FROM active_sessions WHERE session_id = ?")
      .get(sessionId) as Session | undefined;

    if (session) {
      this.db
        .prepare(
          "UPDATE active_sessions SET last_active = CURRENT_TIMESTAMP WHERE session_id = ?"
        )
        .run(sessionId);
      return true;
    }
    return false;
  }

  async getUserSessions(username: string) {
    return this.db
      .prepare(
        "SELECT * FROM active_sessions WHERE username = ? ORDER BY last_active DESC"
      )
      .all(username) as Session[];
  }

  async removeSession(sessionId: string) {
    this.db
      .prepare("DELETE FROM active_sessions WHERE session_id = ?")
      .run(sessionId);
  }
}

export const sessionManager = new SessionManager();
