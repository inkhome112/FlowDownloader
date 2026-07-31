import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AppConfig } from '../config/types';
import logger from '../logger/Logger';

export class CdpStrategy {
  private browser: Browser | null = null;

  public async attach(config: AppConfig): Promise<{ context: BrowserContext; page: Page }> {
    const cdpUrl = `http://127.0.0.1:${config.cdpPort}`;
    logger.info(`Connecting over CDP to ${cdpUrl}...`);

    try {
      this.browser = await chromium.connectOverCDP(cdpUrl);
      const contexts = this.browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();

      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      logger.info('Successfully attached to external Chrome via CDP.');
      return { context, page };
    } catch (err) {
      logger.error(`CDP connection failed to ${cdpUrl}: ${(err as Error).message}`);
      throw err;
    }
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
