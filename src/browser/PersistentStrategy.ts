import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { AppConfig } from '../config/types';
import logger from '../logger/Logger';
import { FileUtils } from '../utils/FileUtils';

export class PersistentStrategy {
  private context: BrowserContext | null = null;

  public async launch(config: AppConfig): Promise<{ context: BrowserContext; page: Page }> {
    const userDataDir = path.resolve(config.userDataDir);
    FileUtils.ensureDirectory(userDataDir);

    const executablePath = fs.existsSync(config.chromeExecutablePath)
      ? config.chromeExecutablePath
      : undefined;

    if (executablePath) {
      logger.info(`Using system Chrome executable: ${executablePath}`);
    } else {
      logger.info('System Chrome not found at configured path. Using Playwright default Chromium.');
    }

    logger.info(`Launching persistent context with user-data-dir: ${userDataDir}`);
    logger.info(`Headless mode: ${config.headless}`);

    this.context = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless: config.headless,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
      ],
      viewport: { width: 1280, height: 800 },
    });

    const pages = this.context.pages();
    const page = pages.length > 0 ? pages[0] : await this.context.newPage();

    return { context: this.context, page };
  }

  public async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
