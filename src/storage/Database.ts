import DatabaseConstructor, { Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { VideoRecord } from '../config/types';
import logger from '../logger/Logger';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db!: SqliteDatabase;
  private dbPath: string;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.resolve(process.cwd(), 'data', 'flowdownloader.db');
    this.openDatabase();
    this.initSchema();
  }

  private openDatabase(): SqliteDatabase {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        // Ignore close errors
      }
    }
    this.db = new DatabaseConstructor(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    return this.db;
  }

  private getDb(): SqliteDatabase {
    if (!this.db) {
      return this.openDatabase();
    }
    try {
      this.db.pragma('user_version');
      return this.db;
    } catch (err) {
      return this.openDatabase();
    }
  }

  public static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    } else if (dbPath && DatabaseManager.instance.dbPath !== dbPath) {
      DatabaseManager.instance.close();
      DatabaseManager.instance = new DatabaseManager(dbPath);
    } else {
      DatabaseManager.instance.getDb();
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
        thumbnail_path TEXT,
        filesize INTEGER,
        checksum TEXT,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(download_status);
    `;
    this.getDb().exec(query);

    try {
      const tableInfo = this.getDb().prepare("PRAGMA table_info('videos')").all() as any[];
      const hasThumbnailCol = tableInfo.some((col) => col.name === 'thumbnail_path');
      if (!hasThumbnailCol) {
        this.getDb().exec('ALTER TABLE videos ADD COLUMN thumbnail_path TEXT;');
        logger.info('Migrated SQLite schema: added thumbnail_path column.');
      }
    } catch (err) {
      // Ignore migration errors if column exists
    }
  }

  public getVideo(id: string): VideoRecord | undefined {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
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

    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO videos (id, prompt, download_status, retry_count, created_at, updated_at)
      VALUES (?, ?, 'PENDING', 0, ?, ?)
    `);
    stmt.run(id, prompt, now, now);
    return this.getVideo(id)!;
  }

  public markCompleted(
    id: string,
    details: { filename: string; filepath: string; filesize: number; checksum: string; thumbnail_path?: string }
  ): void {
    const now = new Date().toISOString();
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE videos
      SET download_status = 'COMPLETED',
          download_date = ?,
          filename = ?,
          filepath = ?,
          filesize = ?,
          checksum = ?,
          thumbnail_path = ?,
          error_message = NULL,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, details.filename, details.filepath, details.filesize, details.checksum, details.thumbnail_path || null, now, id);
    logger.info(`Video ${id} marked as COMPLETED (${details.filename})`);
  }

  public markFailed(id: string, errorMessage: string): void {
    const now = new Date().toISOString();
    const db = this.getDb();
    const stmt = db.prepare(`
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
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE videos
      SET retry_count = retry_count + 1,
          error_message = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(errorMessage, now, id);
  }

  public getStats(dateFilterMode?: string, specificDate?: string): { total: number; completed: number; pending: number; failed: number } {
    const db = this.getDb();
    let baseSql = 'WHERE 1=1';
    const params: any[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateFilterMode === 'TODAY') {
      baseSql += ' AND (download_date LIKE ? OR (download_date IS NULL AND created_at LIKE ?))';
      params.push(`${todayStr}%`, `${todayStr}%`);
    } else if (dateFilterMode === 'SPECIFIC' && specificDate) {
      baseSql += ' AND (download_date LIKE ? OR (download_date IS NULL AND created_at LIKE ?))';
      params.push(`${specificDate}%`, `${specificDate}%`);
    }

    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM videos ${baseSql}`);
    const completedStmt = db.prepare(`SELECT COUNT(*) as count FROM videos ${baseSql} AND download_status = 'COMPLETED'`);
    const pendingStmt = db.prepare(`SELECT COUNT(*) as count FROM videos ${baseSql} AND download_status = 'PENDING'`);
    const failedStmt = db.prepare(`SELECT COUNT(*) as count FROM videos ${baseSql} AND download_status = 'FAILED'`);

    return {
      total: (totalStmt.get(...params) as any).count,
      completed: (completedStmt.get(...params) as any).count,
      pending: (pendingStmt.get(...params) as any).count,
      failed: (failedStmt.get(...params) as any).count,
    };
  }

  public getAllRecords(search?: string, statusFilter?: string, dateFilterMode?: string, specificDate?: string): VideoRecord[] {
    const db = this.getDb();
    let sql = 'SELECT * FROM videos WHERE 1=1';
    const params: any[] = [];

    if (search) {
      sql += ' AND (prompt LIKE ? OR filename LIKE ? OR id LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (statusFilter && statusFilter !== 'ALL') {
      sql += ' AND download_status = ?';
      params.push(statusFilter);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateFilterMode === 'TODAY') {
      sql += ' AND (download_date LIKE ? OR (download_date IS NULL AND created_at LIKE ?))';
      params.push(`${todayStr}%`, `${todayStr}%`);
    } else if (dateFilterMode === 'SPECIFIC' && specificDate) {
      sql += ' AND (download_date LIKE ? OR (download_date IS NULL AND created_at LIKE ?))';
      params.push(`${specificDate}%`, `${specificDate}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    return stmt.all(...params) as VideoRecord[];
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        // Ignore close errors
      }
    }
  }
}
