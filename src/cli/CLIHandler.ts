import { Command } from 'commander';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../storage/Database';
import { BrowserFactory } from '../browser/BrowserFactory';
import { ChromeLauncher } from '../browser/ChromeLauncher';
import { FlowDetector } from '../flow/FlowDetector';
import { VideoDownloader } from '../downloader/VideoDownloader';
import logger from '../logger/Logger';

export class CLIHandler {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('flowdownloader')
      .description('Production-quality Windows application to automatically download Google Flow videos.')
      .version('1.0.0');

    this.program
      .command('start')
      .description('Start the automated detection and downloader loop')
      .option('-s, --strategy <strategy>', 'Browser strategy (auto, persistent, cdp)')
      .option('-h, --headless <boolean>', 'Run browser in headless mode')
      .option('-i, --interval <ms>', 'Polling interval in milliseconds')
      .action(async (options) => {
        const configManager = ConfigManager.getInstance();
        const overrides: any = {};
        if (options.strategy) overrides.browserStrategy = options.strategy;
        if (options.headless !== undefined) overrides.headless = options.headless === 'true';
        if (options.interval) overrides.pollIntervalMs = parseInt(options.interval, 10);

        const config = configManager.updateConfig(overrides);
        await this.runStartLoop(config);
      });

    this.program
      .command('launch-chrome')
      .description('Launch Chrome with remote debugging flags for CDP attachment')
      .action(() => {
        const config = ConfigManager.getInstance().getConfig();
        ChromeLauncher.launchChromeForCDP(config.chromeExecutablePath, config.cdpPort, config.userDataDir);
        logger.info(`Chrome launched on port ${config.cdpPort}. You can now run "flowdownloader start --strategy cdp"`);
      });

    this.program
      .command('status')
      .description('Show database download statistics and record counts')
      .action(() => {
        const db = DatabaseManager.getInstance();
        const stats = db.getStats();
        console.log('\n========================================');
        console.log('      FLOWDOWNLOADER STATUS REPORT      ');
        console.log('========================================');
        console.log(` Total Tracked Videos : ${stats.total}`);
        console.log(` Completed Downloads  : ${stats.completed}`);
        console.log(` Pending Downloads    : ${stats.pending}`);
        console.log(` Failed Downloads     : ${stats.failed}`);
        console.log('========================================\n');
      });

    this.program
      .command('config')
      .description('Display current configuration settings')
      .action(() => {
        const config = ConfigManager.getInstance().getConfig();
        console.log('\n========================================');
        console.log('       CURRENT CONFIGURATION           ');
        console.log('========================================');
        console.log(JSON.stringify(config, null, 2));
        console.log('========================================\n');
      });
  }

  private async runStartLoop(config: any): Promise<void> {
    logger.info('========================================================');
    logger.info('   STARTING FLOWDOWNLOADER AUTOMATION ENGINE           ');
    logger.info('========================================================');
    logger.info(`Target Flow URL: ${config.flowUrl}`);
    logger.info(`Download Folder: ${config.downloadFolder}`);
    logger.info(`Poll Interval  : ${config.pollIntervalMs} ms`);

    let browserSession;
    try {
      browserSession = await BrowserFactory.create(config);
    } catch (err) {
      logger.error(`Failed to launch browser session: ${(err as Error).message}`);
      process.exit(1);
    }

    const { page, cleanup } = browserSession;

    const handleExit = async () => {
      logger.info('Shutting down FlowDownloader cleanly...');
      await cleanup();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    // Initial authentication check
    const isAuthenticated = await FlowDetector.ensureAuthenticated(page, config.flowUrl);
    if (!isAuthenticated) {
      logger.error('Authentication check failed or timed out. Exiting.');
      await cleanup();
      process.exit(1);
    }

    const downloader = new VideoDownloader(config);

    // Polling loop
    let isRunning = true;
    while (isRunning) {
      try {
        logger.info('--- Polling Cycle Started ---');
        const items = await FlowDetector.detectItems(page, config.autoScrollOnPoll);
        const result = await downloader.processItems(page, items);

        logger.info(
          `Cycle finished. Downloaded: ${result.downloaded}, Skipped: ${result.skipped}, Failed: ${result.failed}`
        );
      } catch (err) {
        logger.error(`Error during polling cycle: ${(err as Error).message}`);
      }

      logger.info(`Waiting ${config.pollIntervalMs / 1000} seconds until next polling cycle...`);
      await new Promise((res) => setTimeout(res, config.pollIntervalMs));
    }
  }

  public parse(args: string[]): void {
    this.program.parse(args);
  }
}
