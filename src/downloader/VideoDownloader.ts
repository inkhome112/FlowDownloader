import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { AppConfig } from '../config/types';
import { DetectedFlowItem } from '../flow/types';
import { DatabaseManager } from '../storage/Database';
import { FileUtils } from '../utils/FileUtils';
import { TemplateEngine } from '../utils/TemplateEngine';
import { MediaProcessor } from './MediaProcessor';
import { Notifier } from '../utils/Notifier';
import logger from '../logger/Logger';

export class VideoDownloader {
  private db: DatabaseManager;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.db = DatabaseManager.getInstance();
    FileUtils.ensureDirectory(this.config.downloadFolder);
  }

  public async processItems(page: Page, items: DetectedFlowItem[]): Promise<{ downloaded: number; skipped: number; failed: number }> {
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
      if (item.status !== 'completed' || !item.videoUrl) {
        logger.debug(`Skipping incomplete item ${item.id} (Status: ${item.status})`);
        continue;
      }

      const isDownloaded = this.db.isAlreadyDownloaded(item.id);
      if (isDownloaded) {
        logger.info(`Video ${item.id} already downloaded. Skipping.`);
        skipped++;
        continue;
      }

      const dbRecord = this.db.savePendingVideo(item.id, item.prompt);
      if (dbRecord.retry_count >= this.config.retryCount) {
        logger.warn(`Video ${item.id} reached maximum retry limit (${this.config.retryCount}). Skipping.`);
        failed++;
        continue;
      }

      logger.info(`Starting download for video ${item.id} ("${item.prompt.slice(0, 40)}...")`);

      let attempts = 0;
      let success = false;

      while (attempts < this.config.retryCount && !success) {
        attempts++;
        try {
          const result = await this.downloadVideoFile(page, item);
          const checksum = await FileUtils.calculateSHA256(result.filepath);

          // Post-processing: Embed metadata & generate thumbnail if enabled
          MediaProcessor.embedMetadata(result.filepath, item.prompt, item.id);
          
          let thumbnailPath: string | undefined = undefined;
          if (this.config.generateThumbnails) {
            const thumbDir = path.join(this.config.downloadFolder, 'thumbnails');
            thumbnailPath = MediaProcessor.generateThumbnail(result.filepath, thumbDir, item.id);
          }

          this.db.markCompleted(item.id, {
            filename: result.filename,
            filepath: result.filepath,
            filesize: result.filesize,
            checksum,
            thumbnail_path: thumbnailPath,
          });

          logger.info(`Successfully downloaded ${result.filename} (${(result.filesize / 1024 / 1024).toFixed(2)} MB)`);

          // Windows Desktop Notification
          if (this.config.enableDesktopNotifications) {
            Notifier.notify(
              'FlowDownloader - New Video Saved 🎬',
              `Downloaded: "${item.prompt.slice(0, 50)}..."`
            );
          }

          downloaded++;
          success = true;
        } catch (err) {
          const errorMsg = (err as Error).message;
          logger.error(`Download attempt ${attempts}/${this.config.retryCount} failed for ${item.id}: ${errorMsg}`);
          this.db.incrementRetry(item.id, errorMsg);

          if (attempts < this.config.retryCount) {
            await new Promise((res) => setTimeout(res, 3000 * attempts));
          } else {
            this.db.markFailed(item.id, `Failed after ${attempts} attempts: ${errorMsg}`);
            failed++;
          }
        }
      }
    }

    return { downloaded, skipped, failed };
  }

  private async downloadVideoFile(
    page: Page,
    item: DetectedFlowItem
  ): Promise<{ filename: string; filepath: string; filesize: number }> {
    const template = this.config.fileTemplate || '{prompt_slug}_{id}.{ext}';
    const { filename, fullPath: targetPath } = TemplateEngine.formatPath(
      template,
      this.config.downloadFolder,
      item.id,
      item.prompt,
      'mp4'
    );

    FileUtils.ensureDirectory(path.dirname(targetPath));

    const videoUrl = item.videoUrl!;

    if (videoUrl.startsWith('blob:')) {
      logger.info(`Downloading blob video via browser context: ${videoUrl}`);
      const base64Data = await page.evaluate(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }, videoUrl);

      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(targetPath, buffer);
    } else {
      logger.info(`Fetching video stream via authenticated browser request: ${videoUrl}`);
      const response = await page.request.get(videoUrl);
      if (!response.ok()) {
        throw new Error(`HTTP error ${response.status()}: ${response.statusText()}`);
      }
      const buffer = await response.body();
      fs.writeFileSync(targetPath, buffer);
    }

    const filesize = FileUtils.getFileSize(targetPath);
    if (filesize === 0) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      throw new Error('Downloaded video file is 0 bytes.');
    }

    return { filename, filepath: targetPath, filesize };
  }
}
