# FlowDownloader Configuration Guide

FlowDownloader can be configured using `config.json` in the root directory or via environment variables / CLI flags.

---

## `config.json` Example

```json
{
  "downloadFolder": "./downloads",
  "pollIntervalMs": 30000,
  "retryCount": 3,
  "headless": false,
  "browserStrategy": "auto",
  "cdpPort": 9222,
  "chromeExecutablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "userDataDir": "./user_data",
  "flowUrl": "https://labs.google/flow",
  "autoScrollOnPoll": true
}
```

---

## Configuration Parameter Reference

| Parameter | Type | Default | Description |
|---|---|---|---|
| `downloadFolder` | `string` | `"./downloads"` | Absolute or relative path where downloaded `.mp4` video files are saved. |
| `pollIntervalMs` | `number` | `30000` | Polling interval in milliseconds between scanning cycles. |
| `retryCount` | `number` | `3` | Maximum download retry attempts before marking video as `FAILED` in database. |
| `headless` | `boolean` | `false` | Whether to run browser in headless mode. *(Set `false` for initial manual login)*. |
| `browserStrategy` | `string` | `"auto"` | Connection strategy: `"auto"`, `"persistent"`, or `"cdp"`. |
| `cdpPort` | `number` | `9222` | Port number used when connecting via Chrome DevTools Protocol (`cdp`). |
| `chromeExecutablePath` | `string` | `"C:\\Program Files\\..."` | Absolute path to Google Chrome executable on Windows. |
| `userDataDir` | `string` | `"./user_data"` | Path to dedicated isolated Chrome user data directory. |
| `flowUrl` | `string` | `"https://labs.google/flow"` | Target Google Flow application URL. |
| `autoScrollOnPoll` | `boolean` | `true` | Automatically scroll down page during polling cycles to lazy-load generations. |

---

## CLI Overrides

Parameters can also be overridden at runtime via CLI:

```powershell
# Run in headless mode with 1-minute polling interval
npm run start -- --headless true --interval 60000

# Force CDP browser attachment strategy
npm run start -- --strategy cdp
```
