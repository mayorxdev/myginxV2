import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";
import * as fs from "fs";
import * as path from "path";
import type { Config } from "@/types";

interface FileStats {
  size: number;
  modified: Date;
  isSymlink?: boolean;
}

interface DebugInfo {
  paths: {
    dataDir: string;
    configPath: string;
    blacklistPath: string;
    dataDbPath: string;
  };
  exists: {
    dataDir: boolean;
    configPath: boolean;
    blacklistPath: boolean;
    dataDbPath: boolean;
  };
  stats: Record<string, FileStats>;
  symlinks: Record<string, string>;
  content: Record<string, string>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get data directory paths
    const dataDir = path.resolve(process.cwd(), "data");
    const configPath = path.join(dataDir, "config.json");
    const blacklistPath = path.join(dataDir, "blacklist.txt");
    const dataDbPath = path.join(dataDir, "data.db");

    // Gather debug information
    const debug: DebugInfo = {
      paths: {
        dataDir,
        configPath,
        blacklistPath,
        dataDbPath,
      },
      exists: {
        dataDir: fs.existsSync(dataDir),
        configPath: fs.existsSync(configPath),
        blacklistPath: fs.existsSync(blacklistPath),
        dataDbPath: fs.existsSync(dataDbPath),
      },
      stats: {},
      symlinks: {},
      content: {},
    };

    // Get file stats if they exist
    if (debug.exists.configPath) {
      const stats = fs.statSync(configPath);
      debug.stats.config = {
        size: stats.size,
        modified: stats.mtime,
        isSymlink: fs.lstatSync(configPath).isSymbolicLink(),
      };

      // If it's a symlink, get the target
      if (fs.lstatSync(configPath).isSymbolicLink()) {
        debug.symlinks.config = fs.readlinkSync(configPath);
      }

      // Read the first 1000 characters of the config file
      const content = fs.readFileSync(configPath, "utf8");
      debug.content.config = content.substring(0, 1000);
    }

    if (debug.exists.blacklistPath) {
      const stats = fs.statSync(blacklistPath);
      debug.stats.blacklist = {
        size: stats.size,
        modified: stats.mtime,
        isSymlink: fs.lstatSync(blacklistPath).isSymbolicLink(),
      };

      // If it's a symlink, get the target
      if (fs.lstatSync(blacklistPath).isSymbolicLink()) {
        debug.symlinks.blacklist = fs.readlinkSync(blacklistPath);
      }
    }

    if (debug.exists.dataDbPath) {
      const stats = fs.statSync(dataDbPath);
      debug.stats.dataDb = {
        size: stats.size,
        modified: stats.mtime,
        isSymlink: fs.lstatSync(dataDbPath).isSymbolicLink(),
      };

      // If it's a symlink, get the target
      if (fs.lstatSync(dataDbPath).isSymbolicLink()) {
        debug.symlinks.dataDb = fs.readlinkSync(dataDbPath);
      }
    }

    // Test configService read and write operations
    let configRead: Config | null = null;
    let writeSuccess = false;

    if (req.method === "GET") {
      // Read the current config
      configRead = await configService.readConfig();

      return res.status(200).json({
        debug,
        configServiceRead: configRead,
        message: "Read config successfully. Use POST to test writing.",
      });
    } else if (req.method === "POST") {
      // Read the current config
      configRead = await configService.readConfig();

      if (!configRead) {
        return res.status(500).json({
          debug,
          error: "Failed to read config before writing",
        });
      }

      // Make a small modification to test writing
      // Update the telegram token if general section exists
      if (configRead.general) {
        configRead.general.telegram_bot_token = "TEST_TOKEN_" + Date.now();
      }

      // Write back the modified config
      writeSuccess = await configService.writeConfig(configRead);

      // Read again to verify the changes
      const afterWrite = await configService.readConfig();

      return res.status(200).json({
        debug,
        configBeforeWrite: configRead,
        writeSuccess,
        configAfterWrite: afterWrite,
        message: writeSuccess
          ? "Successfully wrote and read back the config"
          : "Failed to write config",
      });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in debug-config endpoint:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
