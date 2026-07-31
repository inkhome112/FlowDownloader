import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { AppConfig } from '../config/types';
import logger from '../logger/Logger';
import { FileUtils } from '../utils/FileUtils';

export class PersistentStrategy {
  private context: BrowserContext | null = null;

  private cleanupStaleLocks(userDataDir: string): void {
    const lockFiles = ['lockfile', 'SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const file of lockFiles) {
      const lockPath = path.join(userDataDir, file);
      if (fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          logger.info(`Cleaned up profile lock file: ${file}`);
        } catch (err) {
          // Ignore if locked by active process
        }
      }
    }
  }

  public async launch(config: AppConfig): Promise<{ context: BrowserContext; page: Page }> {
    let userDataDir = path.resolve(config.userDataDir);
    FileUtils.ensureDirectory(userDataDir);
    this.cleanupStaleLocks(userDataDir);

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

    try {
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
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('ProcessSingleton') || msg.includes('Lock file can not be created')) {
        logger.warn('Detected active Chrome process locking profile directory. Creating secondary profile session directory...');
        userDataDir = path.resolve(`${config.userDataDir}_session`);
        FileUtils.ensureDirectory(userDataDir);
        this.cleanupStaleLocks(userDataDir);

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
      } else {
        throw err;
      }
    }

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
