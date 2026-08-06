import fs from 'fs';
import { exec } from 'child_process';
import logger from '../logger/Logger';

const DIALOG_TIMEOUT_MS = 3000;

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

      const timer = setTimeout(() => {
        logger.debug('FolderPicker: background dialog query timed out (using browser UI picker fallback).');
        settle(null);
      }, DIALOG_TIMEOUT_MS);

      const rawScript = [
        '$ErrorActionPreference = "SilentlyContinue"',
        '$ProgressPreference = "SilentlyContinue"',
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dlg.Description = "Select FlowDownloader Download Directory"',
        '$dlg.ShowNewFolderButton = $true',
        'if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
        '    [Console]::WriteLine($dlg.SelectedPath)',
        '}',
      ].join('\r\n');

      const base64Script = Buffer.from(rawScript, 'utf16le').toString('base64');
      const psCommand = `powershell.exe -NoProfile -STA -EncodedCommand ${base64Script}`;

      const child = exec(psCommand, { timeout: DIALOG_TIMEOUT_MS + 1000 }, (_err, stdout) => {
        clearTimeout(timer);
        const lines = (stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const selectedPath = lines[lines.length - 1] || '';

        if (selectedPath && fs.existsSync(selectedPath)) {
          logger.info(`FolderPicker selected directory: ${selectedPath}`);
          return settle(selectedPath);
        }
        settle(null);
      });

      child.on('error', () => {
        clearTimeout(timer);
        settle(null);
      });
    });
  }
}
