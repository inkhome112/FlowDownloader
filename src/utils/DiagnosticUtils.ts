import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { FileUtils } from './FileUtils';
import logger from '../logger/Logger';

export class DiagnosticUtils {
  public static async captureDiagnostics(page: Page, contextName: string): Promise<{ screenshotPath: string; htmlPath: string }> {
    const diagDir = path.resolve(process.cwd(), 'diagnostics');
    FileUtils.ensureDirectory(diagDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeContext = FileUtils.sanitizeFilename(contextName);

    const screenshotPath = path.join(diagDir, `diag-${safeContext}-${timestamp}.png`);
    const htmlPath = path.join(diagDir, `diag-${safeContext}-${timestamp}.html`);

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const content = await page.content();
      fs.writeFileSync(htmlPath, content, 'utf-8');

      logger.error(
        `[DIAGNOSTIC CAPTURED] Flow UI failure or element missing (${contextName}). ` +
        `Saved screenshot to ${screenshotPath} and HTML content to ${htmlPath}`
      );
    } catch (err) {
      logger.error(`Failed to capture diagnostics: ${(err as Error).message}`);
    }

    return { screenshotPath, htmlPath };
  }
}
