import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import logger from '../logger/Logger';
import { FileUtils } from '../utils/FileUtils';

export class ChromeLauncher {
  public static async isCdpAvailable(port: number = 9222): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  public static launchChromeForCDP(
    chromePath: string,
    port: number,
    userDataDir: string
  ): ChildProcess {
    const resolvedUserData = path.resolve(userDataDir);
    FileUtils.ensureDirectory(resolvedUserData);

    if (!fs.existsSync(chromePath)) {
      throw new Error(`Chrome executable not found at path: ${chromePath}`);
    }

    const args = [
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${resolvedUserData}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      'https://labs.google/flow',
    ];

    logger.info(`Launching Chrome for CDP attachment on port ${port}...`);
    logger.info(`Executable: ${chromePath}`);
    logger.info(`User Data Dir: ${resolvedUserData}`);

    const child = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();
    return child;
  }
}
