import { Page } from 'playwright';
import logger from '../logger/Logger';

export class Watchdog {
  public static async isHealthy(page: Page): Promise<boolean> {
    try {
      if (page.isClosed()) {
        logger.warn('[WATCHDOG] Page is closed.');
        return false;
      }

      // Health ping evaluation with 5s timeout
      const isResponsive = await Promise.race([
        page.evaluate(() => document.readyState === 'complete' || document.readyState === 'interactive'),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
      ]);

      if (!isResponsive) {
        logger.warn('[WATCHDOG] Page evaluation timed out (frozen state).');
        return false;
      }

      return true;
    } catch (err) {
      logger.warn(`[WATCHDOG] Health check failed: ${(err as Error).message}`);
      return false;
    }
  }

  public static async recoverPage(page: Page, targetUrl: string): Promise<boolean> {
    logger.warn(`[WATCHDOG] Triggering auto-recovery for URL: ${targetUrl}...`);
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      });
      await page.waitForTimeout(3000);
      logger.info('[WATCHDOG] Recovery successful. Browser page reloaded.');
      return true;
    } catch (err) {
      logger.error(`[WATCHDOG] Recovery failed: ${(err as Error).message}`);
      return false;
    }
  }
}
