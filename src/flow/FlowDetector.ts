import { Page } from 'playwright';
import crypto from 'crypto';
import { DetectedFlowItem } from './types';
import logger from '../logger/Logger';
import { DiagnosticUtils } from '../utils/DiagnosticUtils';
import { NetworkSniffer } from './NetworkSniffer';
import { Watchdog } from './Watchdog';

export class FlowDetector {
  private static sniffer: NetworkSniffer | null = null;

  public static attachSniffer(page: Page): NetworkSniffer {
    if (!this.sniffer) {
      this.sniffer = new NetworkSniffer();
      this.sniffer.attach(page);
    }
    return this.sniffer;
  }

  public static async ensureAuthenticated(page: Page, flowUrl: string): Promise<boolean> {
    logger.info(`Checking navigation state for ${flowUrl}...`);
    const currentUrl = page.url();

    if (!currentUrl || currentUrl === 'about:blank' || !currentUrl.includes('labs.google')) {
      await page.goto(flowUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((err) => {
        logger.warn(`Initial navigation to ${flowUrl} warning: ${err.message}`);
      });
    }

    let isAuthRequired = page.url().includes('accounts.google.com') || (await page.locator('a[href*="accounts.google.com"], button:has-text("Sign in")').count()) > 0;

    if (isAuthRequired) {
      logger.warn('------------------------------------------------------------');
      logger.warn('ATTENTION REQUIRED: Google Sign-in needed.');
      logger.warn('Please log into your Google account in the opened Chrome window.');
      logger.warn('FlowDownloader will automatically resume once authentication completes.');
      logger.warn('------------------------------------------------------------');

      try {
        await page.waitForURL((url) => url.toString().includes('labs.google'), { timeout: 600000 });
        logger.info('Authentication detected! User is now on Google Flow.');
      } catch (err) {
        logger.error('Timed out waiting for manual Google login.');
        return false;
      }
    }

    await page.waitForTimeout(3000);
    return true;
  }

  public static async detectItems(page: Page, autoScroll: boolean = true, flowUrl: string = 'https://labs.google/flow'): Promise<DetectedFlowItem[]> {
    // Health check via Watchdog
    const healthy = await Watchdog.isHealthy(page);
    if (!healthy) {
      await Watchdog.recoverPage(page, flowUrl);
    }

    logger.info('Scanning Google Flow for video generations (DOM + Network Sniffer)...');

    if (autoScroll) {
      try {
        await page.evaluate(() => {
          window.scrollBy({ top: 500, behavior: 'smooth' });
        });
        await page.waitForTimeout(1500);
      } catch (err) {
        // Ignore scroll errors on detached contexts
      }
    }

    // 1. DOM Selector Parsing
    const domItems: DetectedFlowItem[] = await page.evaluate(() => {
      const results: { id: string; prompt: string; videoUrl?: string; status: 'completed' | 'generating' | 'failed'; rawElementInfo?: string }[] = [];
      const seenIds = new Set<string>();

      const videoElements = Array.from(document.querySelectorAll('video'));
      videoElements.forEach((vidIndex, index) => {
        const vid = vidIndex as HTMLVideoElement;
        const src = vid.src || (vid.querySelector('source')?.src) || '';
        const card = vid.closest('[data-generation-id], [class*="card"], [class*="item"], [class*="generation"], article, div') || vid.parentElement;

        let id = card?.getAttribute('data-generation-id') || card?.getAttribute('id') || '';
        let prompt = '';

        if (card) {
          const promptEl = card.querySelector('[class*="prompt"], [class*="title"], p, span, h2, h3, [aria-label]');
          if (promptEl) {
            prompt = promptEl.textContent?.trim() || promptEl.getAttribute('aria-label') || '';
          }
        }

        if (!id && src) {
          const match = src.match(/\/([a-zA-Z0-9_-]{10,})\b/);
          if (match) id = match[1];
        }

        let status: 'completed' | 'generating' | 'failed' = 'completed';
        if (!src || src.startsWith('blob:') === false && !src.startsWith('http')) {
          status = 'generating';
        }

        if (card?.querySelector('[class*="error"], [class*="failed"], [aria-label*="failed"]')) {
          status = 'failed';
        }

        if (!id) id = `gen-${index + 1}`;

        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            id,
            prompt: prompt || `Google Flow Video ${id}`,
            videoUrl: src || undefined,
            status,
            rawElementInfo: `video tag src length ${src.length}`,
          });
        }
      });

      const downloadLinks = Array.from(document.querySelectorAll('a[download], a[href*=".mp4"], button[aria-label*="Download"], a[aria-label*="Download"]'));
      downloadLinks.forEach((link, index) => {
        const href = (link as HTMLAnchorElement).href || (link as HTMLAnchorElement).getAttribute('data-url') || '';
        const card = link.closest('[data-generation-id], [class*="card"], [class*="item"], article, div');
        let id = card?.getAttribute('data-generation-id') || card?.getAttribute('id') || '';
        let prompt = card?.querySelector('p, span, h2, h3')?.textContent?.trim() || '';

        if (!id && href) {
          const match = href.match(/\/([a-zA-Z0-9_-]{10,})\b/);
          if (match) id = match[1];
        }

        if (!id) id = `dl-${index + 1}`;

        if (!seenIds.has(id) && href) {
          seenIds.add(id);
          results.push({
            id,
            prompt: prompt || `Google Flow Video ${id}`,
            videoUrl: href,
            status: 'completed',
            rawElementInfo: 'download link',
          });
        }
      });

      return results;
    });

    // 2. Combine with Network Sniffer items
    const sniffedItems = this.sniffer ? this.sniffer.getCapturedItems() : [];
    const itemMap = new Map<string, DetectedFlowItem>();

    domItems.forEach((item) => {
      let finalId = item.id;
      if (!finalId || finalId.startsWith('gen-') || finalId.startsWith('dl-')) {
        const hash = crypto
          .createHash('md5')
          .update(`${item.prompt}-${item.videoUrl || ''}`)
          .digest('hex')
          .slice(0, 12);
        finalId = `flow-${hash}`;
      }
      itemMap.set(finalId, { ...item, id: finalId });
    });

    sniffedItems.forEach((item) => {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, item);
      }
    });

    const combinedItems = Array.from(itemMap.values());
    logger.info(`Detected ${combinedItems.length} video generation items on Google Flow (DOM: ${domItems.length}, Network: ${sniffedItems.length}).`);

    if (combinedItems.length === 0) {
      logger.warn('No video generation items detected on page. Capturing diagnostic snapshot...');
      await DiagnosticUtils.captureDiagnostics(page, 'no-items-detected');
    }

    return combinedItems;
  }
}
