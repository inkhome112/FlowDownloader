import DatabaseConstructor, { Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { VideoRecord } from '../config/types';
import logger from '../logger/Logger';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SqliteDatabase;

  private constructor(dbPath?: string) {
    const targetPath = dbPath || path.resolve(process.cwd(), 'data', 'flowdownloader.db');
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseConstructor(targetPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
    logger.info(`Database initialized at ${targetPath}`);
  }

  public static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  private initSchema(): void {
    const query = `
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        prompt TEXT,
        download_status TEXT NOT NULL,
        download_date TEXT,
        filename TEXT,
        filepath TEXT,
        filesize INTEGER,
        checksum TEXT,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(download_status);
    `;
    this.db.exec(query);
  }

  public getVideo(id: string): VideoRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM videos WHERE id = ?');
    return stmt.get(id) as VideoRecord | undefined;
  }

  public isAlreadyDownloaded(id: string): boolean {
    const record = this.getVideo(id);
    return record ? record.download_status === 'COMPLETED' : false;
  }

  public savePendingVideo(id: string, prompt: string): VideoRecord {
    const existing = this.getVideo(id);
    const now = new Date().toISOString();

    if (existing) {
      return existing;
    }

    const stmt = this.db.prepare(`
      INSERT INTO videos (id, prompt, download_status, retry_count, created_at, updated_at)
      VALUES (?, ?, 'PENDING', 0, ?, ?)
    `);
    stmt.run(id, prompt, now, now);
    return this.getVideo(id)!;
  }

  public markCompleted(
    id: string,
    details: { filename: string; filepath: string; filesize: number; checksum: string }
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE videos
      SET download_status = 'COMPLETED',
          download_date = ?,
          filename = ?,
          filepath = ?,
          filesize = ?,
          checksum = ?,
          error_message = NULL,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, details.filename, details.filepath, details.filesize, details.checksum, now, id);
    logger.info(`Video ${id} marked as COMPLETED (${details.filename})`);
  }

  public markFailed(id: string, errorMessage: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE videos
      SET download_status = 'FAILED',
          retry_count = retry_count + 1,
          error_message = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(errorMessage, now, id);
    logger.warn(`Video ${id} marked as FAILED. Reason: ${errorMessage}`);
  }

  public incrementRetry(id: string, errorMessage: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE videos
      SET retry_count = retry_count + 1,
          error_message = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(errorMessage, now, id);
  }

  public getStats(): { total: number; completed: number; pending: number; failed: number } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM videos');
    const completedStmt = this.db.prepare("SELECT COUNT(*) as count FROM videos WHERE download_status = 'COMPLETED'");
    const pendingStmt = this.db.prepare("SELECT COUNT(*) as count FROM videos WHERE download_status = 'PENDING'");
    const failedStmt = this.db.prepare("SELECT COUNT(*) as count FROM videos WHERE download_status = 'FAILED'");

    return {
      total: (totalStmt.get() as any).count,
      completed: (completedStmt.get() as any).count,
      pending: (pendingStmt.get() as any).count,
      failed: (failedStmt.get() as any).count,
    };
  }

  public getAllRecords(): VideoRecord[] {
    const stmt = this.db.prepare('SELECT * FROM videos ORDER BY created_at DESC');
    return stmt.all() as VideoRecord[];
  }

  public close(): void {
    this.db.close();
  }
}
