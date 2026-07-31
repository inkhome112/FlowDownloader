import { BrowserContext, Page } from 'playwright';
import { AppConfig } from '../config/types';
import { PersistentStrategy } from './PersistentStrategy';
import { CdpStrategy } from './CdpStrategy';
import { ChromeLauncher } from './ChromeLauncher';
import logger from '../logger/Logger';

export interface ConnectedBrowser {
  context: BrowserContext;
  page: Page;
  strategyUsed: 'persistent' | 'cdp';
  cleanup: () => Promise<void>;
}

export class BrowserFactory {
  public static async create(config: AppConfig): Promise<ConnectedBrowser> {
    const strategySetting = config.browserStrategy;
    logger.info(`Configured browser strategy: ${strategySetting}`);

    if (strategySetting === 'cdp') {
      const isAvailable = await ChromeLauncher.isCdpAvailable(config.cdpPort);
      if (!isAvailable) {
        logger.warn(`CDP port ${config.cdpPort} is not responding. Attempting to auto-launch Chrome for CDP...`);
        ChromeLauncher.launchChromeForCDP(config.chromeExecutablePath, config.cdpPort, config.userDataDir);
        await new Promise((res) => setTimeout(res, 3000));
      }

      const cdpStrategy = new CdpStrategy();
      const { context, page } = await cdpStrategy.attach(config);
      return {
        context,
        page,
        strategyUsed: 'cdp',
        cleanup: () => cdpStrategy.close(),
      };
    }

    if (strategySetting === 'persistent') {
      const persistentStrategy = new PersistentStrategy();
      const { context, page } = await persistentStrategy.launch(config);
      return {
        context,
        page,
        strategyUsed: 'persistent',
        cleanup: () => persistentStrategy.close(),
      };
    }

    // 'auto' mode
    logger.info('Auto strategy selected. Checking for existing CDP debugging session...');
    const isCdpActive = await ChromeLauncher.isCdpAvailable(config.cdpPort);

    if (isCdpActive) {
      logger.info(`Detected active CDP session on port ${config.cdpPort}. Attaching via CDP...`);
      try {
        const cdpStrategy = new CdpStrategy();
        const { context, page } = await cdpStrategy.attach(config);
        return {
          context,
          page,
          strategyUsed: 'cdp',
          cleanup: () => cdpStrategy.close(),
        };
      } catch (err) {
        logger.warn(`CDP attachment failed. Falling back to persistent context... Reason: ${(err as Error).message}`);
      }
    } else {
      logger.info('No active CDP session found on port 9222. Using stealth persistent context strategy.');
    }

    const persistentStrategy = new PersistentStrategy();
    const { context, page } = await persistentStrategy.launch(config);
    return {
      context,
      page,
      strategyUsed: 'persistent',
      cleanup: () => persistentStrategy.close(),
    };
  }
}
