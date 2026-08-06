# FlowDownloader Configuration Guide

FlowDownloader can be configured using `config.json` in the root directory, via the Web Dashboard, or via CLI flags.

---

## Web Dashboard — Save Directory

The **Save Directory** setting in the Web Dashboard controls where all downloaded `.mp4` videos are saved.

### How to Use

1. Open the FlowDownloader dashboard at `http://localhost:3000`
2. Find the **📥 Save Directory** row in the settings panel
3. **Type the full absolute Windows path** into the input box
4. Click **Save Directory**

### ✅ Correct Usage (Absolute Paths)

```
D:\MyVideos
D:\Users\YourName\Downloads\FlowVideos
C:\FlowDownloads
D:\OneDrive\Flow
```

### ❌ Incorrect Usage (Relative Paths — Will NOT work as expected)

```
downloads          ← resolves inside the FlowDownloader project folder
.\MyVideos         ← resolves inside the FlowDownloader project folder
\MyVideos          ← resolves to root of current drive
```

> **⚠️ Known Issue**: If a relative path (e.g. `downloads`) is stored in `config.json`, the dashboard input box will display only the relative name instead of the resolved absolute path. Always use a full drive path (e.g. `D:\MyVideos`) to avoid ambiguity.  
> **Workaround**: Type the full absolute path directly into the Save Directory input box and click Save Directory.

---

## `config.json` Example

```json
{
  "downloadFolder": "D:\\MyVideos",
  "pollIntervalMs": 30000,
  "retryCount": 3,
  "headless": false,
  "browserStrategy": "auto",
  "cdpPort": 9222,
  "chromeExecutablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "userDataDir": "./user_data",
  "flowUrl": "https://labs.google/fx/tools/flow",
  "autoScrollOnPoll": true
}
```

> **Note**: In `config.json`, backslashes must be escaped as `\\`. In the Web Dashboard input box, use single backslashes as normal (`D:\MyVideos`).

---

## Configuration Parameter Reference

| Parameter | Type | Default | Description |
|---|---|---|---|
| `downloadFolder` | `string` | `"downloads"` | **Must be an absolute Windows path** (e.g. `D:\\MyVideos`). The folder where downloaded `.mp4` video files are saved. |
| `pollIntervalMs` | `number` | `15000` | Polling interval in milliseconds between scanning cycles. |
| `maxRetries` | `number` | `3` | Maximum download retry attempts before marking video as `FAILED` in database. |
| `headless` | `boolean` | `false` | Whether to run browser in headless mode. *(Set `false` for initial manual login)*. |
| `browserStrategy` | `string` | `"auto"` | Connection strategy: `"auto"`, `"persistent"`, or `"cdp"`. |
| `cdpPort` | `number` | `9222` | Port number used when connecting via Chrome DevTools Protocol (`cdp`). |
| `chromeExecutablePath` | `string` | `"C:\\Program Files\\..."` | Absolute path to Google Chrome executable on Windows. |
| `userDataDir` | `string` | `"./user_data"` | Path to dedicated isolated Chrome user data directory. |
| `flowUrl` | `string` | `"https://labs.google/fx/tools/flow"` | Target Google Flow application URL. |
| `autoScrollOnPoll` | `boolean` | `true` | Automatically scroll down page during polling cycles to lazy-load generations. |
| `webPort` | `number` | `3000` | Port for the Web Dashboard UI. |
| `enableAutoArchiving` | `boolean` | `false` | Enable automatic archiving when storage quota is exceeded. |
| `maxStorageGb` | `number` | `50` | Maximum storage quota in GB before auto-archiving triggers. |
| `autoArchiveDays` | `number` | `30` | Retention period in days for auto-archiving. |
| `dateFilterMode` | `string` | `"TODAY"` | Dashboard date filter mode: `"TODAY"`, `"ALL"`, or `"SPECIFIC"`. |

---

## CLI Overrides

Parameters can also be overridden at runtime via CLI:

```powershell
# Run in headless mode with 1-minute polling interval
npm run start -- --headless true --interval 60000

# Force CDP browser attachment strategy
npm run start -- --strategy cdp
```
