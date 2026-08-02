import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../storage/Database';
import { MediaProcessor } from '../downloader/MediaProcessor';
import { BackfillThumbnails } from '../utils/BackfillThumbnails';
import logger from '../logger/Logger';

export class WebServer {
  private app: express.Express;
  private server: http.Server | null = null;
  private port: number;
  private onTriggerSync?: () => Promise<void>;
  private dbManager?: DatabaseManager;

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

    // Force browser to always fetch fresh HTML (cache-busting for index.html)
    this.app.get('/', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const indexPath = path.resolve(__dirname, 'public', 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Dashboard not found.');
      }
    });

    const publicDir = path.resolve(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
      this.app.use(express.static(publicDir, { etag: false, maxAge: 0 }));
    }
  }

  private setupRoutes(): void {
    const configManager = ConfigManager.getInstance();

    // GET /api/stats - Dashboard counters
    this.app.get('/api/stats', (_req: Request, res: Response) => {
      try {
        const stats = this.getDb().getStats();
        res.json(stats);
      } catch (err) {
        if ((err as Error).message.includes('not open')) {
          const stats = DatabaseManager.getInstance().getStats();
          return res.json(stats);
        }
        console.error('API STATS ERROR:', err);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/videos - List videos with search & status filter
    this.app.get('/api/videos', (req: Request, res: Response) => {
      try {
        const search = (req.query.search as string) || '';
        const status = (req.query.status as string) || 'ALL';
        const records = this.getDb().getAllRecords(search, status);
        res.json(records);
      } catch (err) {
        if ((err as Error).message.includes('not open')) {
          const search = (req.query.search as string) || '';
          const status = (req.query.status as string) || 'ALL';
          const records = DatabaseManager.getInstance().getAllRecords(search, status);
          return res.json(records);
        }
        console.error('API VIDEOS ERROR:', err);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/thumbnail/:id - Serve video thumbnail image
    this.app.get('/api/thumbnail/:id', (req: Request, res: Response) => {
      try {
        const videoId = String(req.params.id);
        const db = this.getDb();
        const record = db.getVideo(videoId);
        if (!record) {
          return res.status(404).send('Not found');
        }

        let thumbPath = record.thumbnail_path;
        if ((!thumbPath || !fs.existsSync(thumbPath)) && record.filepath && fs.existsSync(record.filepath)) {
          const config = configManager.getConfig();
          const thumbDir = path.join(config.downloadFolder, 'thumbnails');
          thumbPath = MediaProcessor.generateThumbnail(record.filepath, thumbDir, record.id);
          if (thumbPath) {
            db.markCompleted(record.id, {
              filename: record.filename || `${record.id}.mp4`,
              filepath: record.filepath,
              filesize: record.filesize || 0,
              checksum: record.checksum || '',
              thumbnail_path: thumbPath,
            });
          }
        }

        if (thumbPath && fs.existsSync(thumbPath)) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return fs.createReadStream(thumbPath).pipe(res);
        }

        return res.status(404).send('Thumbnail unavailable');
      } catch (err) {
        console.error('API THUMBNAIL ERROR:', err);
        return res.status(500).send('Internal Server Error');
      }
    });

    // GET /api/stream/:id - Stream video file directly
    this.app.get('/api/stream/:id', (req: Request, res: Response) => {
      try {
        const videoId = String(req.params.id);
        const record = this.getDb().getVideo(videoId);
        if (!record || !record.filepath || !fs.existsSync(record.filepath)) {
          return res.status(404).json({ error: 'Video file not found' });
        }

        const stat = fs.statSync(record.filepath);
        const fileSize = stat.size;
        const rawRange = req.headers['range'];
        const rangeStr: string | undefined = typeof rawRange === 'string'
          ? rawRange
          : (Array.isArray(rawRange) ? rawRange[0] : undefined);

        if (rangeStr) {
          const parts = rangeStr.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = end - start + 1;
          const file = fs.createReadStream(record.filepath, { start, end });
          const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
          };
          res.writeHead(206, head);
          file.pipe(res);
        } else {
          const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
          };
          res.writeHead(200, head);
          fs.createReadStream(record.filepath).pipe(res);
        }
      } catch (err) {
        console.error('API STREAM ERROR:', err);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/config & POST /api/config
    this.app.get('/api/config', (_req: Request, res: Response) => {
      res.json(configManager.getConfig());
    });

    this.app.post('/api/config', (req: Request, res: Response) => {
      const updated = configManager.updateConfig(req.body);
      res.json(updated);
    });

    // POST /api/trigger - Immediate scan cycle trigger
    this.app.post('/api/trigger', async (_req: Request, res: Response) => {
      if (this.onTriggerSync) {
        this.onTriggerSync().catch(() => {});
        return res.json({ success: true, message: 'Sync cycle triggered.' });
      }
      res.json({ success: false, message: 'Sync trigger unavailable.' });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      BackfillThumbnails.run();
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
