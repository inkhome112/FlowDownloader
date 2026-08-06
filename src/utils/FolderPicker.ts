import fs from 'fs';
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

      // Raw PowerShell script with stream error/progress suppression
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

      // Base64 UTF-16LE encoding prevents shell parsers from stripping variable names like $dlg
      const base64Script = Buffer.from(rawScript, 'utf16le').toString('base64');
      const psCommand = `powershell.exe -NoProfile -STA -EncodedCommand ${base64Script}`;

      const child = exec(psCommand, { timeout: DIALOG_TIMEOUT_MS + 2000 }, (err, stdout, stderr) => {
        clearTimeout(timer);

        // Check stdout first — if user picked a directory, return it regardless of CLIXML stderr messages
        const lines = (stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const selectedPath = lines[lines.length - 1] || '';

        if (selectedPath && fs.existsSync(selectedPath)) {
          logger.info(`FolderPicker selected directory: ${selectedPath}`);
          return settle(selectedPath);
        }

        if (err) {
          // Ignore harmless CLIXML stream wrapper errors if user cancelled
          if (!stderr || !stderr.includes('CLIXML')) {
            logger.warn(`FolderPicker non-critical notice: ${err.message}`);
          }
          return settle(null);
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
