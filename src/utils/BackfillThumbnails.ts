import path from 'path';
import fs from 'fs';
import { DatabaseManager } from '../storage/Database';
import { ConfigManager } from '../config/ConfigManager';
import { MediaProcessor } from '../downloader/MediaProcessor';
import logger from '../logger/Logger';

export class BackfillThumbnails {
  public static run(): number {
    const config = ConfigManager.getInstance().getConfig();
    const db = DatabaseManager.getInstance();
    const records = db.getAllRecords('', 'COMPLETED');
    const thumbDir = path.join(config.downloadFolder, 'thumbnails');

    let count = 0;
    for (const record of records) {
      const hasThumb = record.thumbnail_path && fs.existsSync(record.thumbnail_path);
      if (!hasThumb && record.filepath && fs.existsSync(record.filepath)) {
        try {
          const generatedPath = MediaProcessor.generateThumbnail(record.filepath, thumbDir, record.id);
          if (generatedPath) {
            db.markCompleted(record.id, {
              filename: record.filename || `${record.id}.mp4`,
              filepath: record.filepath,
              filesize: record.filesize || 0,
              checksum: record.checksum || '',
              thumbnail_path: generatedPath,
            });
            count++;
          }
        } catch (err) {
          logger.warn(`Failed to backfill thumbnail for ${record.id}: ${(err as Error).message}`);
        }
      }
    }

    if (count > 0) {
      logger.info(`Backfilled thumbnails for ${count} existing completed videos.`);
    }
    return count;
  }
}
