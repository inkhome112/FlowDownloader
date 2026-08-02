import notifier from 'node-notifier';
import path from 'path';
import logger from '../logger/Logger';

export class Notifier {
  public static notify(title: string, message: string, iconPath?: string): void {
    try {
      notifier.notify({
        title: title || 'FlowDownloader',
        message: message || 'Notification',
        icon: iconPath || path.resolve(process.cwd(), 'src', 'web', 'public', 'favicon.ico'),
        sound: true,
        wait: false,
      });
      logger.info(`[NOTIFICATION] ${title}: ${message}`);
    } catch (err) {
      logger.warn(`Failed to send desktop notification: ${(err as Error).message}`);
    }
  }
}
