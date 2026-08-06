# FlowDownloader — Known Issues

This document tracks confirmed bugs and known limitations with their current status and workarounds.

---

## [OPEN] Save Directory — Relative Path Displays Incorrectly in Dashboard

**Version Introduced**: v1.3  
**Status**: Open — workaround available  
**Severity**: Low (cosmetic / UX)

### Description

When the `downloadFolder` value stored in `config.json` is a relative path (e.g. `downloads`), the Web Dashboard **Save Directory** input box displays only the short relative name rather than the full resolved absolute path.

This causes confusion because the user sees `downloads` in the input box and may not realise videos are going to `D:\Antigravity Project\FlowDownloader\downloads` (the project subfolder) rather than a custom location they intended.

### Steps to Reproduce

1. Fresh install — default `config.json` has `"downloadFolder": "downloads"`
2. Open dashboard at `http://localhost:3000`
3. Save Directory input shows `downloads` (no full drive path visible)
4. Click Open Download Folder — Explorer opens inside the FlowDownloader project directory

### Root Cause

- The backend stores the raw value from `config.json` without resolving it to an absolute path at display time
- The `GET /api/config` endpoint returns the raw stored string, not the resolved absolute path
- `path.resolve()` was intentionally removed from the save path to fix a separate bug where it was causing user-typed absolute paths to be re-resolved incorrectly

### Workaround ✅

**Always type a full absolute Windows path** in the Save Directory input box, then click **Save Directory**:

```
D:\MyVideos              ✅ Works correctly
D:\Downloads\FlowVideos  ✅ Works correctly
downloads                ❌ Resolves inside project folder
```

Once an absolute path is saved, all future downloads go to that location correctly.

### Planned Fix

- `GET /api/config` should resolve `downloadFolder` to an absolute path before returning it, so the dashboard always shows the full real path
- The save logic must NOT re-resolve the path again on `POST /api/config` (to avoid double-resolution)

---

## [RESOLVED] Browse Folder Button — Dialog Never Appeared

**Version Introduced**: v1.3  
**Resolved in**: v1.5.3  
**Severity**: Medium

### Description

The `📂 Browse...` button was never able to reliably open a native Windows folder picker dialog from a browser-based web page. Multiple approaches were attempted (PowerShell `-STA`, VBScript, Base64 encoded commands) but all failed due to:

1. Windows GUI dialogs require a foreground desktop process with a message loop — Node.js child processes spawned from an HTTP server have no visible window handle
2. Chrome/Edge browser security blocks web pages from reading absolute folder paths from `<input type="file" webkitdirectory>` — only relative or file names are exposed

### Resolution

The Browse button was removed entirely in `v1.5.3`. The **Save Directory** text input + **Save Directory** button is the supported workflow.

---

## [RESOLVED] postConfig Overwriting Save Directory Input

**Version Introduced**: v1.5.2  
**Resolved in**: v1.5.3  
**Severity**: High

### Description

Every call to `postConfig()` (triggered by Save Quota, Apply Filter, etc.) was returning the full config object and overwriting the `downloadFolderInput` value with the old stored path — causing the user's typed path to revert before they could click Save Directory.

### Resolution

`postConfig()` no longer updates the folder input. Only the dedicated **Save Directory** button flow reads back and confirms the saved path.
