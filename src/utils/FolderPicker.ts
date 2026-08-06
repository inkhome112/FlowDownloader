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

      // Raw PowerShell script for FolderBrowserDialog
      const rawScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dlg.Description = "Select FlowDownloader Download Directory"',
        '$dlg.ShowNewFolderButton = $true',
        'if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
        '    [Console]::WriteLine($dlg.SelectedPath)',
        '}',
      ].join('\r\n');

      // Base64 UTF-16LE encoding prevents shell parsers from stripping variable names like $dlg
      const base64Script = Buffer.from(rawScript, 'utf16le').toString('base64');
      const psCommand = `powershell.exe -NoProfile -STA -EncodedCommand ${base64Script}`;

      const child = exec(psCommand, { timeout: DIALOG_TIMEOUT_MS + 2000 }, (err, stdout, stderr) => {
        clearTimeout(timer);
        if (err) {
          logger.error(`FolderPicker execution error: ${err.message}`);
          if (stderr) logger.error(`FolderPicker stderr: ${stderr}`);
          return settle(null);
        }
        const selectedPath = stdout.trim();
        if (selectedPath) {
          logger.info(`FolderPicker selected directory: ${selectedPath}`);
          return settle(selectedPath);
        }
        settle(null);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error(`FolderPicker exec child error: ${err.message}`);
        settle(null);
      });
    });
  }
}
