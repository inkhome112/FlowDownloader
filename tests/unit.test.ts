import test, { describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../src/config/ConfigManager';
import { DatabaseManager } from '../src/storage/Database';
import { FileUtils } from '../src/utils/FileUtils';
import { TemplateEngine } from '../src/utils/TemplateEngine';
import { StorageManager } from '../src/downloader/StorageManager';
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
    const { filename, fullPath } = TemplateEngine.formatPath(template, baseDir, 'id12345', 'A cybernetic cat running', 'mp4');
    assert.strictEqual(filename, 'a_cybernetic_cat_running_id12345.mp4');
    assert.strictEqual(fullPath.includes(todayStr), true);
    assert.strictEqual(fullPath.includes('a_cybernetic_cat_running_id12345.mp4'), true);
  });
});

describe('ConfigManager & StorageManager Tests', () => {
  test('ConfigManager should return valid upgraded default config', () => {
    const config = ConfigManager.getInstance().getConfig();
    assert.strictEqual(typeof config.downloadFolder, 'string');
    assert.strictEqual(config.enableWebDashboard, true);
    assert.strictEqual(config.webPort, 3000);
    assert.strictEqual(config.autoOpenWebBrowser, true);
    assert.strictEqual(config.dateFilterMode, 'TODAY');
    assert.strictEqual(config.hoverVideoPreview, true);
    assert.strictEqual(typeof config.maxStorageGb, 'number');
    assert.strictEqual(typeof config.autoArchiveDays, 'number');
  });

  test('StorageManager should handle folder size calculation cleanly', () => {
    const size = StorageManager.getFolderSize(path.resolve(process.cwd(), 'downloads'));
    assert.strictEqual(typeof size, 'number');
    assert.strictEqual(size >= 0, true);
  });
});

describe('DatabaseManager & WebServer Tests', () => {
  test('WebServer /api/stats and /api/video-info/:id endpoints work correctly', async () => {
    const db = DatabaseManager.getInstance();

    db.savePendingVideo('v3-test-id', 'A futuristic hovercar in neon rain');
    db.markCompleted('v3-test-id', {
      filename: 'v3-test-id.mp4',
      filepath: '/tmp/v3-test-id.mp4',
      filesize: 3145728,
      checksum: 'def456hash',
      thumbnail_path: undefined,
    });

    const record = db.getVideo('v3-test-id');
    assert.strictEqual(record?.id, 'v3-test-id');
    assert.strictEqual(record?.download_status, 'COMPLETED');

    const server = new WebServer(3099, undefined, db);
    await server.start();

    // Stats endpoint
    const statsRes = await fetch('http://127.0.0.1:3099/api/stats').then(r => r.json());
    assert.strictEqual(typeof statsRes.total, 'number');
    assert.strictEqual(statsRes.completed >= 1, true);

    // Video info endpoint
    const infoRes = await fetch('http://127.0.0.1:3099/api/video-info/v3-test-id').then(r => r.json());
    assert.strictEqual(infoRes.id, 'v3-test-id');
    assert.strictEqual(infoRes.download_status, 'COMPLETED');

    await server.stop();
  });
});
