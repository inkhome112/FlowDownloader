import { Page, Response } from 'playwright';
import { DetectedFlowItem } from './types';
import logger from '../logger/Logger';

export class NetworkSniffer {
  private capturedItems: Map<string, DetectedFlowItem> = new Map();

  public attach(page: Page): void {
    page.on('response', async (response: Response) => {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Intercept JSON API endpoints from Google Flow
        if (contentType.includes('application/json') || url.includes('/api/') || url.includes('labs.google')) {
          const status = response.status();
          if (status >= 200 && status < 300) {
            const bodyText = await response.text().catch(() => '');
            if (bodyText.includes('video') || bodyText.includes('generation') || bodyText.includes('mp4')) {
              this.parseJsonResponse(bodyText, url);
            }
          }
        }
      } catch (err) {
        // Ignore unparseable or stream response errors
      }
    });

    logger.info('Network response sniffer attached to Playwright page.');
  }

  private parseJsonResponse(jsonString: string, requestUrl: string): void {
    try {
      const data = JSON.parse(jsonString);
      this.extractVideoItemsRecursive(data, requestUrl);
    } catch (err) {
      // Ignore non-JSON string payloads
    }
  }

  private extractVideoItemsRecursive(obj: any, sourceUrl: string): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item) => this.extractVideoItemsRecursive(item, sourceUrl));
      return;
    }

    // Pattern recognition for Google Flow JSON structures
    const id = obj.id || obj.generationId || obj.videoId || obj.uuid;
    const prompt = obj.prompt || obj.title || obj.description || obj.promptText;
    const videoUrl = obj.videoUrl || obj.mediaUrl || obj.downloadUrl || obj.streamUrl || obj.url;

    if (id && (videoUrl || prompt)) {
      const videoStr = String(videoUrl || '');
      if (videoStr.includes('http') || videoStr.includes('.mp4') || videoStr.includes('googlevideo')) {
        const flowItem: DetectedFlowItem = {
          id: String(id),
          prompt: String(prompt || `Flow Video ${id}`),
          videoUrl: videoStr,
          status: 'completed',
          rawElementInfo: `Sniffed from network (${sourceUrl})`,
        };
        this.capturedItems.set(flowItem.id, flowItem);
        logger.info(`[NETWORK SNIFFER] Extracted video generation item ${flowItem.id} directly from API stream.`);
      }
    }

    // Traverse child properties
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.extractVideoItemsRecursive(obj[key], sourceUrl);
      }
    }
  }

  public getCapturedItems(): DetectedFlowItem[] {
    return Array.from(this.capturedItems.values());
  }

  public clear(): void {
    this.capturedItems.clear();
  }
}
