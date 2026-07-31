import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class FileUtils {
  public static ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  public static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\\/?:*<>|"]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 150);
  }

  public static calculateSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  public static getFileSize(filePath: string): number {
    if (!fs.existsSync(filePath)) return 0;
    const stats = fs.statSync(filePath);
    return stats.size;
  }
}
