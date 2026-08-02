import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { FileUtils } from '../utils/FileUtils';
import logger from '../logger/Logger';

export class MediaProcessor {
  private static ffmpegAvailable: boolean | null = null;

  public static isFFmpegAvailable(): boolean {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable;

    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      this.ffmpegAvailable = true;
      logger.info('FFmpeg binary detected on system PATH. Media post-processing enabled.');
    } catch (err) {
      this.ffmpegAvailable = false;
      logger.info('FFmpeg binary not detected on system PATH. Basic file operations active.');
    }
    return this.ffmpegAvailable;
  }

  public static generateThumbnail(videoPath: string, outputDir: string, videoId: string): string | undefined {
    FileUtils.ensureDirectory(outputDir);
    const thumbFilename = `thumb_${videoId}.jpg`;
    const thumbPath = path.join(outputDir, thumbFilename);

    if (fs.existsSync(thumbPath)) return thumbPath;

    if (!this.isFFmpegAvailable()) {
      return undefined;
    }

    try {
      const cmd = `ffmpeg -y -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 "${thumbPath}"`;
      execSync(cmd, { stdio: 'ignore' });
      if (fs.existsSync(thumbPath)) {
        logger.info(`Generated video thumbnail: ${thumbFilename}`);
        return thumbPath;
      }
    } catch (err) {
      logger.warn(`Failed to generate thumbnail for ${videoId}: ${(err as Error).message}`);
    }

    return undefined;
  }

  public static embedMetadata(videoPath: string, prompt: string, videoId: string): void {
    if (!this.isFFmpegAvailable()) return;

    try {
      const tempOutput = `${videoPath}.tmp.mp4`;
      const safePrompt = prompt.replace(/"/g, '\\"');
      const cmd = `ffmpeg -y -i "${videoPath}" -metadata title="${safePrompt}" -metadata comment="ID: ${videoId}" -c copy "${tempOutput}"`;
      
      execSync(cmd, { stdio: 'ignore' });
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(videoPath);
        fs.renameSync(tempOutput, videoPath);
        logger.info(`Embedded MP4 container metadata tags into ${path.basename(videoPath)}`);
      }
    } catch (err) {
      logger.warn(`Could not embed metadata into ${videoId}: ${(err as Error).message}`);
    }
  }
}
