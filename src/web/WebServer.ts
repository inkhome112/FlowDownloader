import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../storage/Database';
import logger from '../logger/Logger';

const BUILD_TS = Date.now(); // unique per server start — busts browser cache

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

    // Serve index.html with live cache-busting version injected into asset URLs.
    // This guarantees the browser always loads the latest app.js and style.css.
    this.app.get('/', (_req: Request, res: Response) => {
      const indexPath = path.resolve(__dirname, 'public', 'index.html');
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send('Dashboard not found.');
      }
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Inject build timestamp so each server restart = fresh assets
      html = html.replace(/\?v=[\w.]+/g, `?v=${BUILD_TS}`);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(html);
    });

    const publicDir = path.resolve(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
      // Static files: short cache so ?v= busting works on refresh
      this.app.use(express.static(publicDir, { etag: false, maxAge: '1s' }));
    }
  }

  private setupRoutes(): void {
    const configManager = ConfigManager.getInstance();

    // GET /api/stats
    this.app.get('/api/stats', (_req: Request, res: Response) => {
      try {
        res.json(this.getDb().getStats());
      } catch (err) {
        if ((err as Error).message.includes('not open')) return res.json(DatabaseManager.getInstance().getStats());
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // GET /api/videos
    this.app.get('/api/videos', (req: Request, res: Response) => {
      try {
        const search = (req.query.search as string) || '';
        const status = (req.query.status as string) || 'ALL';
        res.json(this.getDb().getAllRecords(search, status));
      } catch (err) {
        if ((err as Error).message.includes('not open')) {
          const search = (req.query.search as string) || '';
          const status = (req.query.status as string) || 'ALL';
          return res.json(DatabaseManager.getInstance().getAllRecords(search, status));
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
      res.json(configManager.updateConfig(req.body));
    });

    // POST /api/trigger
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
