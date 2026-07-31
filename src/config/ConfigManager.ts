import fs from 'fs';
import path from 'path';
import { AppConfig } from './types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;

  private constructor(customConfigPath?: string) {
    this.configPath = customConfigPath || path.resolve(process.cwd(), 'config.json');
    this.config = this.loadConfig();
  }

  public static getInstance(customConfigPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(customConfigPath);
    }
    return ConfigManager.instance;
  }

  private getDefaultConfig(): AppConfig {
    return {
      downloadFolder: path.resolve(process.cwd(), 'downloads'),
      pollIntervalMs: 30000,
      retryCount: 3,
      headless: false,
      browserStrategy: 'auto',
      cdpPort: 9222,
      chromeExecutablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      userDataDir: path.resolve(process.cwd(), 'user_data'),
      flowUrl: 'https://labs.google/flow',
      autoScrollOnPoll: true,
    };
  }

  private loadConfig(): AppConfig {
    const defaults = this.getDefaultConfig();
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(defaults);
      return defaults;
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      
      const config: AppConfig = {
        downloadFolder: parsed.downloadFolder
          ? path.resolve(process.cwd(), parsed.downloadFolder)
          : defaults.downloadFolder,
        pollIntervalMs: typeof parsed.pollIntervalMs === 'number' ? parsed.pollIntervalMs : defaults.pollIntervalMs,
        retryCount: typeof parsed.retryCount === 'number' ? parsed.retryCount : defaults.retryCount,
        headless: typeof parsed.headless === 'boolean' ? parsed.headless : defaults.headless,
        browserStrategy: ['auto', 'persistent', 'cdp'].includes(parsed.browserStrategy)
          ? parsed.browserStrategy
          : defaults.browserStrategy,
        cdpPort: typeof parsed.cdpPort === 'number' ? parsed.cdpPort : defaults.cdpPort,
        chromeExecutablePath: parsed.chromeExecutablePath || defaults.chromeExecutablePath,
        userDataDir: parsed.userDataDir
          ? path.resolve(process.cwd(), parsed.userDataDir)
          : defaults.userDataDir,
        flowUrl: parsed.flowUrl || defaults.flowUrl,
        autoScrollOnPoll: parsed.autoScrollOnPoll !== undefined ? parsed.autoScrollOnPoll : defaults.autoScrollOnPoll,
      };

      return config;
    } catch (err) {
      console.warn(`Failed to parse ${this.configPath}. Falling back to default settings. Error: ${(err as Error).message}`);
      return defaults;
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(newPartialConfig: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...newPartialConfig };
    this.saveConfig(this.config);
    return this.getConfig();
  }

  private saveConfig(config: AppConfig): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Failed to write config file to ${this.configPath}: ${(err as Error).message}`);
    }
  }
}
