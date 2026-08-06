import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../storage/Database';
import { FileUtils } from '../utils/FileUtils';
import { FolderPicker } from '../utils/FolderPicker';
import logger from '../logger/Logger';

const BUILD_TS = Date.now(); // unique per server start — busts browser cache

export class WebServer {
  private app: express.Express;
  private server: http.Server | null = null;
  private port: number;
  private onTriggerSync?: () => Promise<void>;
  private dbManager?: DatabaseManager;
  private isSyncing: boolean = false;

  constructor(port: number = 3000, onTriggerSync?: () => Promise<void>, dbManager?: DatabaseManager) {
    this.port = port;
    this.onTriggerSync = onTriggerSync;
    this.dbManager = dbManager;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private getDb(): DatabaseManager {
    return this.dbManager || DatabaseManager.getInstance();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // Serve index.html with live cache-busting version injected into asset URLs.
    this.app.get('/', (_req: Request, res: Response) => {
      const indexPath = path.resolve(__dirname, 'public', 'index.html');
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send('Dashboard not found.');
      }
      let html = fs.readFileSync(indexPath, 'utf-8');
      html = html.replace(/\?v=[\w.]+/g, `?v=${BUILD_TS}`);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(html);
    });

    const publicDir = path.resolve(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
      this.app.use(express.static(publicDir, { etag: false, maxAge: '1s' }));
    }
  }

  private setupRoutes(): void {
    const configManager = ConfigManager.getInstance();

    // GET /api/stats
    this.app.get('/api/stats', (req: Request, res: Response) => {
      try {
        const dateFilterMode = (req.query.dateFilterMode as string) || undefined;
        const specificDate = (req.query.specificDate as string) || undefined;
        res.json(this.getDb().getStats(dateFilterMode, specificDate));
      } catch (err) {
        if ((err as Error).message.includes('not open')) {
          const dateFilterMode = (req.query.dateFilterMode as string) || undefined;
          const specificDate = (req.query.specificDate as string) || undefined;
          return res.json(DatabaseManager.getInstance().getStats(dateFilterMode, specificDate));
        }
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/videos
    this.app.get('/api/videos', (req: Request, res: Response) => {
      try {
        const search = (req.query.search as string) || '';
        const status = (req.query.status as string) || 'ALL';
        const dateFilterMode = (req.query.dateFilterMode as string) || undefined;
        const specificDate = (req.query.specificDate as string) || undefined;
        res.json(this.getDb().getAllRecords(search, status, dateFilterMode, specificDate));
      } catch (err) {
        if ((err as Error).message.includes('not open')) {
          const search = (req.query.search as string) || '';
          const status = (req.query.status as string) || 'ALL';
          const dateFilterMode = (req.query.dateFilterMode as string) || undefined;
          const specificDate = (req.query.specificDate as string) || undefined;
          return res.json(DatabaseManager.getInstance().getAllRecords(search, status, dateFilterMode, specificDate));
        }
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/video-info/:id — lightweight check for filepath existence
    this.app.get('/api/video-info/:id', (req: Request, res: Response) => {
      try {
        const record = this.getDb().getVideo(String(req.params.id));
        if (!record) return res.status(404).json({ exists: false });
        const fileExists = !!(record.filepath && fs.existsSync(record.filepath));
        res.json({
          id: record.id,
          exists: fileExists,
          filesize: record.filesize || 0,
          download_status: record.download_status,
        });
      } catch (err) {
        res.status(500).json({ exists: false, error: (err as Error).message });
      }
    });

    // GET /api/stream/:id — range-aware video streaming
    this.app.get('/api/stream/:id', (req: Request, res: Response) => {
      try {
        const record = this.getDb().getVideo(String(req.params.id));
        if (!record || !record.filepath || !fs.existsSync(record.filepath)) {
          return res.status(404).json({ error: 'Video file not found' });
        }

        const stat = fs.statSync(record.filepath);
        const fileSize = stat.size;
        const rawRange = req.headers['range'];
        const rangeStr: string | undefined = typeof rawRange === 'string'
          ? rawRange : (Array.isArray(rawRange) ? rawRange[0] : undefined);

        if (rangeStr) {
          const parts = rangeStr.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': 'video/mp4',
          });
          fs.createReadStream(record.filepath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
          });
          fs.createReadStream(record.filepath).pipe(res);
        }
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/config & POST /api/config
    this.app.get('/api/config', (_req: Request, res: Response) => {
      res.json(configManager.getConfig());
    });

    this.app.post('/api/config', (req: Request, res: Response) => {
      const updated = configManager.updateConfig(req.body);
      if (req.body.downloadFolder) {
        FileUtils.ensureDirectory(req.body.downloadFolder);
      }
      res.json(updated);
    });

    // POST /api/open-folder - Launch Windows File Explorer at download folder
    this.app.post('/api/open-folder', (_req: Request, res: Response) => {
      try {
        const downloadFolder = configManager.getConfig().downloadFolder;
        FileUtils.ensureDirectory(downloadFolder);
        exec(`explorer.exe "${downloadFolder}"`);
        logger.info(`Opened download folder in Windows Explorer: ${downloadFolder}`);
        res.json({ success: true, folder: downloadFolder });
      } catch (err) {
        res.status(500).json({ success: false, error: (err as Error).message });
      }
    });

    // POST /api/browse-folder - Open Windows Folder Browser Dialog via FolderPicker (PowerShell -STA)
    this.app.post('/api/browse-folder', async (_req: Request, res: Response) => {
      try {
        const folderPath = await FolderPicker.openDialog();
        if (folderPath) {
          return res.json({ success: true, folderPath });
        }
        return res.json({ success: false, cancelled: true });
      } catch (err) {
        logger.error(`Browse folder route error: ${(err as Error).message}`);
        res.status(500).json({ success: false, error: (err as Error).message });
      }
    });

    // POST /api/trigger - Await scan cycle trigger
    this.app.post('/api/trigger', async (_req: Request, res: Response) => {
      if (!this.onTriggerSync) {
        return res.json({ success: false, message: 'Sync trigger unavailable.' });
      }
      if (this.isSyncing) {
        return res.json({ success: false, message: 'Sync cycle already in progress.' });
      }

      this.isSyncing = true;
      try {
        logger.info('Manual Trigger Sync initiated from Web GUI...');
        await this.onTriggerSync();
        res.json({ success: true, message: 'Sync cycle finished successfully!' });
      } catch (err) {
        logger.error(`Manual Trigger Sync error: ${(err as Error).message}`);
        res.status(500).json({ success: false, message: `Sync failed: ${(err as Error).message}` });
      } finally {
        this.isSyncing = false;
      }
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Web GUI Dashboard listening at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
