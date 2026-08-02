import fs from 'fs';
import path from 'path';
import { AppConfig } from '../config/types';
import { DatabaseManager } from '../storage/Database';
import logger from '../logger/Logger';

export class StorageManager {
  public static checkAndCleanup(config: AppConfig): { purgedFiles: number; freedBytes: number } {
    if (!config.enableAutoArchiving) {
      return { purgedFiles: 0, freedBytes: 0 };
    }

    let purgedFiles = 0;
    let freedBytes = 0;

    const db = DatabaseManager.getInstance();
    const records = db.getAllRecords('', 'COMPLETED');
    const now = Date.now();
    const maxAgeMs = (config.autoArchiveDays || 30) * 24 * 60 * 60 * 1000;
    const maxBytes = (config.maxStorageGb || 50) * 1024 * 1024 * 1024;

    // 1. Purge files older than autoArchiveDays
    for (const record of records) {
      if (record.filepath && fs.existsSync(record.filepath)) {
        const createdAt = new Date(record.created_at || record.download_date || 0).getTime();
        if (now - createdAt > maxAgeMs) {
          try {
            const stat = fs.statSync(record.filepath);
            fs.unlinkSync(record.filepath);
            freedBytes += stat.size;
            purgedFiles++;
            logger.info(`StorageManager: Purged video file ${record.filename} older than ${config.autoArchiveDays} days.`);
          } catch (err) {
            logger.warn(`StorageManager: Failed to delete ${record.filepath}: ${(err as Error).message}`);
          }
        }
      }
    }

    // 2. Enforce maxStorageGb threshold
    let totalSize = this.getFolderSize(config.downloadFolder);
    if (totalSize > maxBytes) {
      // Sort completed records oldest first
      const sortedRecords = [...records].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      for (const record of sortedRecords) {
        if (totalSize <= maxBytes) break;
        if (record.filepath && fs.existsSync(record.filepath)) {
          try {
            const stat = fs.statSync(record.filepath);
            fs.unlinkSync(record.filepath);
            totalSize -= stat.size;
            freedBytes += stat.size;
            purgedFiles++;
            logger.info(`StorageManager: Purged video ${record.filename} to maintain ${config.maxStorageGb} GB storage limit.`);
          } catch (err) {
            // Ignore error
          }
        }
      }
    }

    if (purgedFiles > 0) {
      logger.info(`StorageManager Cleanup Summary: Purged ${purgedFiles} video files, freed ${(freedBytes / 1024 / 1024).toFixed(2)} MB.`);
    }

    return { purgedFiles, freedBytes };
  }

  public static getFolderSize(folderPath: string): number {
    let totalSize = 0;
    if (!fs.existsSync(folderPath)) return 0;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          totalSize += this.getFolderSize(fullPath);
        } else {
          totalSize += stat.size;
        }
      } catch (err) {
        // Ignore unreadable files
      }
    }

    return totalSize;
  }
}
