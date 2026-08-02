import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../storage/Database';
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
    const publicDir = path.resolve(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
      this.app.use(express.static(publicDir));
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
