import { Command } from 'commander';
import { exec } from 'child_process';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../storage/Database';
import { BrowserFactory } from '../browser/BrowserFactory';
import { ChromeLauncher } from '../browser/ChromeLauncher';
import { FlowDetector } from '../flow/FlowDetector';
import { VideoDownloader } from '../downloader/VideoDownloader';
import { WebServer } from '../web/WebServer';
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
      .version('1.1.0');

    this.program
      .command('start')
      .description('Start the automated detection, downloader loop, and Web GUI')
      .option('-s, --strategy <strategy>', 'Browser strategy (auto, persistent, cdp)')
      .option('-h, --headless <boolean>', 'Run browser in headless mode')
      .option('-i, --interval <ms>', 'Polling interval in milliseconds')
      .option('-p, --port <number>', 'Web GUI Dashboard HTTP port')
      .option('-d, --date-filter <mode>', 'Date filter mode: TODAY, ALL, SPECIFIC')
      .option('-f, --specific-date <date>', 'Specific date for filtering (YYYY-MM-DD)')
      .action(async (options) => {
        const configManager = ConfigManager.getInstance();
        const overrides: any = {};
        if (options.strategy) overrides.browserStrategy = options.strategy;
        if (options.headless !== undefined) overrides.headless = options.headless === 'true';
        if (options.interval) overrides.pollIntervalMs = parseInt(options.interval, 10);
        if (options.port) overrides.webPort = parseInt(options.port, 10);
        if (options.dateFilter) overrides.dateFilterMode = options.dateFilter.toUpperCase();
        if (options.specificDate) overrides.specificDate = options.specificDate;

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
    logger.info(`Date Filter    : ${config.dateFilterMode || 'TODAY'} ${config.specificDate ? '(' + config.specificDate + ')' : ''}`);

    let browserSession;
    try {
      browserSession = await BrowserFactory.create(config);
    } catch (err) {
      logger.error(`Failed to launch browser session: ${(err as Error).message}`);
      process.exit(1);
    }

    const { page, cleanup } = browserSession;

    FlowDetector.attachSniffer(page);

    const downloader = new VideoDownloader(config);

    const runCycle = async () => {
      const activeConfig = ConfigManager.getInstance().getConfig();
      logger.info('--- Polling Cycle Started ---');
      const items = await FlowDetector.detectItems(page, activeConfig.autoScrollOnPoll, activeConfig.flowUrl);
      const result = await downloader.processItems(page, items);
      logger.info(
        `Cycle finished. Downloaded: ${result.downloaded}, Skipped: ${result.skipped}, Failed: ${result.failed}`
      );
    };

    let webServer: WebServer | null = null;
    if (config.enableWebDashboard !== false) {
      const port = config.webPort || 3000;
      webServer = new WebServer(port, runCycle);
      await webServer.start();
      if (config.autoOpenWebBrowser !== false) {
        const url = `http://localhost:${port}`;
        logger.info(`Opening Web GUI Dashboard in default browser: ${url}`);
        try {
          exec(`start ${url}`);
        } catch (err) {
          // Ignore browser open errors
        }
      }
    }

    const handleExit = async () => {
      logger.info('Shutting down FlowDownloader cleanly...');
      if (webServer) await webServer.stop();
      await cleanup();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    const isAuthenticated = await FlowDetector.ensureAuthenticated(page, config.flowUrl);
    if (!isAuthenticated) {
      logger.error('Authentication check failed or timed out. Exiting.');
      if (webServer) await webServer.stop();
      await cleanup();
      process.exit(1);
    }

    let isRunning = true;
    while (isRunning) {
      try {
        await runCycle();
      } catch (err) {
        logger.error(`Error during polling cycle: ${(err as Error).message}`);
      }

      const activeConfig = ConfigManager.getInstance().getConfig();
      const interval = activeConfig.pollIntervalMs || 15000;
      logger.info(`Waiting ${interval / 1000} seconds until next polling cycle...`);
      await new Promise((res) => setTimeout(res, interval));
    }
  }

  public parse(args: string[]): void {
    if (args.length <= 2) {
      args = [...args, 'start'];
    }
    this.program.parse(args);
  }
}
