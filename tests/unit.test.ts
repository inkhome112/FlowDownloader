import test, { describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../src/config/ConfigManager';
import { DatabaseManager } from '../src/storage/Database';
import { FileUtils } from '../src/utils/FileUtils';

describe('FileUtils Tests', () => {
  test('sanitizeFilename should remove illegal characters', () => {
    const raw = 'Test / Video * Name: With? Illegal | Chars < > "';
    const sanitized = FileUtils.sanitizeFilename(raw);
    assert.strictEqual(sanitized.includes('*'), false);
    assert.strictEqual(sanitized.includes('?'), false);
    assert.strictEqual(sanitized.includes('<'), false);
  });

  test('ensureDirectory should create missing folder', () => {
    const testDir = path.resolve(process.cwd(), 'scratch_test_dir');
    FileUtils.ensureDirectory(testDir);
    assert.strictEqual(fs.existsSync(testDir), true);
    fs.rmdirSync(testDir);
  });
});

describe('ConfigManager Tests', () => {
  test('ConfigManager should return valid default config', () => {
    const config = ConfigManager.getInstance().getConfig();
    assert.strictEqual(typeof config.downloadFolder, 'string');
    assert.strictEqual(typeof config.pollIntervalMs, 'number');
    assert.strictEqual(config.retryCount, 3);
  });
});

describe('DatabaseManager Tests', () => {
  test('DatabaseManager should save and track video states', () => {
    const testDbPath = path.resolve(process.cwd(), 'data', 'test_flow.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const db = DatabaseManager.getInstance(testDbPath);
    
    // Save pending video
    const video = db.savePendingVideo('test-id-123', 'A futuristic cybernetic city video');
    assert.strictEqual(video.id, 'test-id-123');
    assert.strictEqual(video.download_status, 'PENDING');

    // Check stats
    let stats = db.getStats();
    assert.strictEqual(stats.total, 1);
    assert.strictEqual(stats.pending, 1);
    assert.strictEqual(stats.completed, 0);

    // Mark completed
    db.markCompleted('test-id-123', {
      filename: 'test-id-123.mp4',
      filepath: '/path/to/test-id-123.mp4',
      filesize: 1048576,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });

    assert.strictEqual(db.isAlreadyDownloaded('test-id-123'), true);

    stats = db.getStats();
    assert.strictEqual(stats.completed, 1);
    assert.strictEqual(stats.pending, 0);

    // Cleanup
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });
});
