# FlowDownloader Architecture & Chrome Technical Analysis

## Executive Summary

FlowDownloader is built on clean, maintainable architecture designed to operate robustly on modern Windows environments while adhering strictly to Google security policies.

---

## Technical Analysis: Why Previous CDP / Playwright Approaches Failed

During initial testing, several browser connection strategies were attempted. The exact technical causes for failure are documented below:

### 1. Playwright Default Chromium / Real Chrome Launch Blocked ("This browser or app may not be secure")
- **Technical Cause**: By default, Playwright launches browsers with automation flags (`--enable-automation`, setting `navigator.webdriver = true`, and CDP automation overrides). Google identity servers evaluate browser environment fingerprints during OAuth / Sign-in. When `navigator.webdriver` is detected as `true`, Google blocks login immediately.
- **Resolution**: FlowDownloader strips `--enable-automation` using `ignoreDefaultArgs: ['--enable-automation']` and injects `--disable-blink-features=AutomationControlled`.

### 2. `connectOverCDP()` to Chrome Profile Returned "This site can't be reached" (`http://127.0.0.1:9222/json/version`)
- **Technical Cause 1 (Process IPC Routing & Profile Locking)**: On Windows, Chrome runs background tasks (updates, extensions, system tray processes). When Chrome is already running under the default user data directory (`%LOCALAPPDATA%\Google\Chrome\User Data`), launching `chrome.exe --remote-debugging-port=9222 ...` sends IPC flags to the *already running master process*. Modern Chromium master processes reject adding a new remote debugging port after initialization.
- **Technical Cause 2 (Single-Process Directory Lock)**: Chromium enforces a single-process lock file (`LOCK`) on the `User Data` directory. Two Chrome processes cannot share the same `User Data` directory simultaneously.
- **Technical Cause 3 (Origin Header Security Enforcement)**: Modern Chromium versions enforce strict HTTP origin verification on `/json/version` and WebSocket endpoints. Connecting without `--remote-allow-origins=*` causes connection resets or HTTP 403 Forbidden errors.
- **Resolution**: FlowDownloader resolves this by using an isolated dedicated user profile directory (`./user_data`) and including `--remote-allow-origins=*` when running in CDP mode.

---

## Clean System Architecture

FlowDownloader is split into decoupled, single-responsibility modules:

```
                  +-----------------------+
                  |  CLI Handler / Entry  |
                  +-----------+-----------+
                              |
     +------------------------+------------------------+
     |                        |                        |
+----+----+              +----+----+              +----+----+
| Config  |              | Browser |              | Logger  |
| Manager |              | Factory |              | Manager |
+---------+              +----+----+              +---------+
                              |
                     +--------+--------+
                     |                 |
            +--------+--------+  +-----+----------+
            |  Persistent     |  | CDP External   |
            |  Stealth Context|  | Strategy       |
            +--------+--------+  +-----+----------+
                     |                 |
                     +--------+--------+
                              |
                     +--------+--------+
                     | Flow Detector   |
                     +--------+--------+
                              |
                     +--------+--------+
                     | VideoDownloader|
                     +--------+--------+
                              |
                     +--------+--------+
                     | SQLite Storage  |
                     +-----------------+
```

### Module Responsibilities

1. **`Browser/`**:
   - `BrowserFactory`: Evaluates strategy configuration (`auto`, `persistent`, `cdp`) and manages fallback.
   - `PersistentStrategy`: Stealth Playwright context using dedicated `user_data` directory.
   - `CdpStrategy`: CDP connection over port 9222.
   - `ChromeLauncher`: Helper process spawner for remote debugging.

2. **`Flow/`**:
   - `FlowDetector`: Monitors Google Flow DOM. Performs resilient card discovery, status parsing (`completed`, `generating`, `failed`), and triggers diagnostic snapshots if DOM changes.

3. **`Downloader/`**:
   - `VideoDownloader`: Downloads video files via authenticated browser context (handling both HTTP URLs and `blob:` object URLs). Calculates SHA256 checksums and file sizes.

4. **`Storage/`**:
   - `DatabaseManager`: Manages SQLite database (`data/flowdownloader.db`). Tracks status, retries, timestamps, and error messages.

5. **`Logger/`**:
   - `LoggerManager`: Winston daily rotating logs (`logs/flowdownloader-YYYY-MM-DD.log`) and formatted console logging.

6. **`Utils/`**:
   - `DiagnosticUtils`: Captures full-page screenshots and HTML snapshots on selector mismatch.
   - `FileUtils`: Provides SHA256 hashing and filename sanitization.
