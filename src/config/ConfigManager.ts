import fs from 'fs';
import path from 'path';
import { AppConfig } from './types';
import logger from '../logger/Logger';

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private config!: AppConfig;

  private constructor(configPath?: string) {
    this.configPath = configPath || path.resolve(process.cwd(), 'config.json');
    this.loadConfig();
  }

  public static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }

  private getDefaultConfig(): AppConfig {
    return {
      flowUrl: 'https://labs.google/fx/tools/flow',
      downloadFolder: path.resolve(process.cwd(), 'downloads'),
      pollIntervalMs: 15000,
      browserStrategy: 'auto',
      chromeExecutablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      cdpPort: 9222,
      userDataDir: path.resolve(process.cwd(), 'user_data'),
      headless: false,
      maxRetries: 3,
      autoScrollOnPoll: true,
      enableWebDashboard: true,
      webPort: 3000,
      enableDesktopNotifications: true,
      fileTemplate: '{date}/{prompt_slug}_{id}.{ext}',
      generateThumbnails: false,
      autoOpenWebBrowser: true,
      dateFilterMode: 'TODAY',
      specificDate: '',
      enableAutoArchiving: false,
      maxStorageGb: 50,
      autoArchiveDays: 30,
      hoverVideoPreview: true,
    };
  }

  private loadConfig(): void {
    const defaults = this.getDefaultConfig();
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = { ...defaults, ...parsed };
      } else {
        this.config = defaults;
        this.saveConfig();
      }
    } catch (err) {
      logger.error(`Failed to load config from ${this.configPath}. Using defaults. Error: ${(err as Error).message}`);
      this.config = defaults;
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    return this.getConfig();
  }

  public saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info(`Configuration saved to ${this.configPath}`);
    } catch (err) {
      logger.error(`Failed to save config to ${this.configPath}: ${(err as Error).message}`);
    }
  }
}
