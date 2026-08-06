import os from 'os';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import logger from '../logger/Logger';

const DIALOG_TIMEOUT_MS = 15000;

export class FolderPicker {
  public static openDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      // Build a temporary PowerShell script file.
      // PowerShell must be invoked with -STA (Single-Threaded Apartment) to allow
      // Windows Forms GUI dialogs to appear. Without -STA, FolderBrowserDialog
      // is silently cancelled by Windows before it opens.
      const tempPsPath = path.join(os.tmpdir(), 'flow_folder_picker.ps1');
      const psCode = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.Description = "Select FlowDownloader Download Directory"',
        '$dialog.ShowNewFolderButton = $true',
        '$result = $dialog.ShowDialog()',
        'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
        '  Write-Output $dialog.SelectedPath',
        '}',
      ].join('\r\n');

      let settled = false;
      const settle = (val: string | null) => {
        if (!settled) {
          settled = true;
          try {
            if (fs.existsSync(tempPsPath)) fs.unlinkSync(tempPsPath);
          } catch (_) { /* ignore cleanup */ }
          resolve(val);
        }
      };

      // 15-second hard timeout — re-enables the Browse button even if the dialog hangs
      const timer = setTimeout(() => {
        logger.warn('FolderPicker: dialog timed out after 15 seconds.');
        settle(null);
      }, DIALOG_TIMEOUT_MS);

      try {
        fs.writeFileSync(tempPsPath, psCode, 'utf-8');

        // -STA is the critical flag — it enables Windows Forms GUI thread model
        execFile(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', tempPsPath],
          { timeout: DIALOG_TIMEOUT_MS + 2000 },
          (err, stdout, stderr) => {
            clearTimeout(timer);
            if (err) {
              logger.error(`FolderPicker PowerShell error: ${err.message}`);
              if (stderr) logger.error(`FolderPicker stderr: ${stderr}`);
              return settle(null);
            }
            const selectedPath = stdout.trim();
            if (selectedPath) {
              logger.info(`FolderPicker selected: ${selectedPath}`);
              return settle(selectedPath);
            }
            settle(null);
          }
        );
      } catch (err) {
        clearTimeout(timer);
        logger.error(`FolderPicker failed to write PS1 script: ${(err as Error).message}`);
        settle(null);
      }
    });
  }
}
