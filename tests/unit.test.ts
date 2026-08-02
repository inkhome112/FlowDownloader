import test, { describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../src/config/ConfigManager';
import { DatabaseManager } from '../src/storage/Database';
import { FileUtils } from '../src/utils/FileUtils';
import { TemplateEngine } from '../src/utils/TemplateEngine';
import { WebServer } from '../src/web/WebServer';

describe('FileUtils & TemplateEngine Tests', () => {
  test('sanitizeFilename should remove illegal characters', () => {
    const raw = 'Test / Video * Name: With? Illegal | Chars < > "';
    const sanitized = FileUtils.sanitizeFilename(raw);
    assert.strictEqual(sanitized.includes('*'), false);
    assert.strictEqual(sanitized.includes('?'), false);
    assert.strictEqual(sanitized.includes('<'), false);
  });

  test('TemplateEngine should replace placeholders correctly and include date subfolder', () => {
    const template = '{date}/{prompt_slug}_{id}.{ext}';
    const baseDir = path.resolve(process.cwd(), 'downloads');
    const todayStr = new Date().toISOString().slice(0, 10);
    const { filename, fullPath } = TemplateEngine.formatPath(
      template,
      baseDir,
      'id12345',
      'A cybernetic cat running',
      'mp4'
    );

    assert.strictEqual(filename, 'a_cybernetic_cat_running_id12345.mp4');
    assert.strictEqual(fullPath.includes(todayStr), true);
    assert.strictEqual(fullPath.includes('a_cybernetic_cat_running_id12345.mp4'), true);
  });
});

describe('ConfigManager Tests', () => {
  test('ConfigManager should return valid upgraded default config with date filtering and auto browser launch', () => {
    const config = ConfigManager.getInstance().getConfig();
    assert.strictEqual(typeof config.downloadFolder, 'string');
    assert.strictEqual(config.enableWebDashboard, true);
    assert.strictEqual(config.webPort, 3000);
    assert.strictEqual(typeof config.fileTemplate, 'string');
    assert.strictEqual(config.autoOpenWebBrowser, true);
    assert.strictEqual(config.dateFilterMode, 'TODAY');
  });
});

describe('DatabaseManager & WebServer Tests', () => {
  test('DatabaseManager should save records with thumbnail_path and handle WebServer APIs', async () => {
    const db = DatabaseManager.getInstance();

    const dummyThumb = path.resolve(process.cwd(), 'downloads', 'thumbnails', 'thumb_v2-test-id.jpg');
    FileUtils.ensureDirectory(path.dirname(dummyThumb));
    fs.writeFileSync(dummyThumb, Buffer.from('fake-image-data'));

    db.savePendingVideo('v2-test-id', 'A futuristic hovercar in neon rain');
    db.markCompleted('v2-test-id', {
      filename: 'v2-test-id.mp4',
      filepath: '/tmp/v2-test-id.mp4',
      filesize: 2048576,
      checksum: 'abc123hash',
      thumbnail_path: dummyThumb,
    });

    const record = db.getVideo('v2-test-id');
    assert.strictEqual(record?.id, 'v2-test-id');
    assert.strictEqual(record?.thumbnail_path, dummyThumb);

    const stats = db.getStats();
    assert.strictEqual(stats.completed >= 1, true);

    const server = new WebServer(3099, undefined, db);
    await server.start();

    const response = await fetch('http://127.0.0.1:3099/api/stats');
    assert.strictEqual(response.status, 200);

    const statsRes = await response.json();
    assert.strictEqual(typeof statsRes.total, 'number');
    assert.strictEqual(statsRes.completed >= 1, true);

    const thumbRes = await fetch('http://127.0.0.1:3099/api/thumbnail/v2-test-id');
    assert.strictEqual(thumbRes.status, 200);
    assert.strictEqual(thumbRes.headers.get('content-type'), 'image/jpeg');

    await server.stop();
    if (fs.existsSync(dummyThumb)) fs.unlinkSync(dummyThumb);
  });
});
