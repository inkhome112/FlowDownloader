import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import logger from '../logger/Logger';

export class FolderPicker {
  public static openDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      const tempVbsPath = path.join(os.tmpdir(), 'flow_folder_picker.vbs');
      const vbsCode = `
Set objShell = CreateObject("Shell.Application")
Set objFolder = objShell.BrowseForFolder(0, "Select FlowDownloader Download Directory", 0, 17)
If Not objFolder Is Nothing Then
    WScript.Echo objFolder.Self.Path
End If
`.trim();

      try {
        fs.writeFileSync(tempVbsPath, vbsCode, 'utf-8');
        exec(`cscript //nologo "${tempVbsPath}"`, (err, stdout) => {
          try {
            if (fs.existsSync(tempVbsPath)) {
              fs.unlinkSync(tempVbsPath);
            }
          } catch (e) {
            // Ignore cleanup error
          }

          if (err) {
            logger.error(`FolderPicker VBScript execution error: ${err.message}`);
            return resolve(null);
          }

          const selectedPath = stdout.trim();
          if (selectedPath) {
            logger.info(`FolderPicker selected path: ${selectedPath}`);
            return resolve(selectedPath);
          }
          resolve(null);
        });
      } catch (err) {
        logger.error(`Failed to create VBScript folder picker: ${(err as Error).message}`);
        resolve(null);
      }
    });
  }
}
