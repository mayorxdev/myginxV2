import Database from "better-sqlite3";
import { compare } from "bcrypt";

export class PasswordHistoryService {
  private db: ReturnType<typeof Database>;
  private readonly MAX_HISTORY = 5;

  constructor() {
    this.db = new Database("./data/auth.db");
    this.initPasswordHistoryTable();
  }

  private initPasswordHistoryTable() {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS password_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
      )
      .run();
  }

  async addToHistory(username: string, hashedPassword: string) {
    // Add new password to history
    this.db
      .prepare(
        "INSERT INTO password_history (username, password) VALUES (?, ?)"
      )
      .run(username, hashedPassword);

    // Remove old passwords if exceeding MAX_HISTORY
    const count = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM password_history WHERE username = ?"
      )
      .get(username) as { count: number };

    if (count.count > this.MAX_HISTORY) {
      this.db
        .prepare(
          `
        DELETE FROM password_history 
        WHERE username = ? 
        AND id NOT IN (
          SELECT id FROM password_history 
          WHERE username = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        )
      `
        )
        .run(username, username, this.MAX_HISTORY);
    }
  }

  async isPasswordReused(
    username: string,
    newPassword: string
  ): Promise<boolean> {
    const histories = this.db
      .prepare("SELECT password FROM password_history WHERE username = ?")
      .all(username) as { password: string }[];

    for (const history of histories) {
      if (await compare(newPassword, history.password)) {
        return true;
      }
    }
    return false;
  }
}

export const passwordHistoryService = new PasswordHistoryService();
