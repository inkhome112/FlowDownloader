import path from 'path';
import { FileUtils } from './FileUtils';

export class TemplateEngine {
  public static createSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '_')
      .slice(0, 60);
  }

  public static formatPath(
    template: string,
    baseFolder: string,
    id: string,
    prompt: string,
    ext: string = 'mp4'
  ): { filename: string; fullPath: string } {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${now.getDate().toString().padStart(2, '0')}`;
    const safePrompt = FileUtils.sanitizeFilename(prompt || 'video');
    const promptSlug = this.createSlug(prompt || 'video');
    const safeId = FileUtils.sanitizeFilename(id);

    let result = template || '{prompt_slug}_{id}.{ext}';
    result = result.replace(/{id}/g, safeId);
    result = result.replace(/{prompt}/g, safePrompt);
    result = result.replace(/{prompt_slug}/g, promptSlug || safeId);
    result = result.replace(/{date}/g, dateStr);
    result = result.replace(/{year}/g, year);
    result = result.replace(/{month}/g, month);
    result = result.replace(/{ext}/g, ext);

    const relativePath = result.replace(/[\\/]+/g, path.sep);
    const filename = path.basename(relativePath);
    const fullPath = path.resolve(baseFolder, relativePath);

    return { filename, fullPath };
  }
}
