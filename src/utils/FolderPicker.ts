import { exec } from 'child_process';
import logger from '../logger/Logger';

const DIALOG_TIMEOUT_MS = 15000;

export class FolderPicker {
  public static openDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (val: string | null) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };

      // 15-second hard timeout — re-enables the Browse button even if the dialog hangs
      const timer = setTimeout(() => {
        logger.warn('FolderPicker: dialog timed out after 15 seconds.');
        settle(null);
      }, DIALOG_TIMEOUT_MS);

      // Use the same inline -Command approach that worked in v1.3.
      // The inline -Command string runs in a COM STA context on Windows,
      // which allows Windows Forms dialogs to render correctly.
      const psCommand =
        `powershell -Command "` +
        `[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; ` +
        `$f = New-Object System.Windows.Forms.FolderBrowserDialog; ` +
        `$f.Description = 'Select FlowDownloader Download Directory'; ` +
        `if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }` +
        `"`;

      const child = exec(psCommand, { timeout: DIALOG_TIMEOUT_MS + 2000 }, (err, stdout) => {
        clearTimeout(timer);
        if (err) {
          logger.error(`FolderPicker error: ${err.message}`);
          return settle(null);
        }
        const selectedPath = stdout.trim();
        if (selectedPath) {
          logger.info(`FolderPicker selected: ${selectedPath}`);
          return settle(selectedPath);
        }
        settle(null);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error(`FolderPicker exec error: ${err.message}`);
        settle(null);
      });
    });
  }
}
