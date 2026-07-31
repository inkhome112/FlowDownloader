# FlowDownloader 🎬

**FlowDownloader** is a production-quality Windows application designed to automatically monitor Google Flow, detect completed video generations, and download them reliably with SQLite persistence, automated retries, and comprehensive diagnostic logging.

---

## Key Features

- **Robust Browser Architecture**: Automatically detects active Chrome remote debugging sessions (CDP) or launches a stealth persistent Google Chrome context.
- **Manual Authentication Preserved**: Completely respects Google identity security policies. Performs **no automated login** and uses no illegal bypasses. User signs in manually once; session tokens persist in a dedicated isolated user profile.
- **SQLite Persistence**: Powered by `better-sqlite3`. Tracks video IDs, prompts, file sizes, SHA256 checksums, timestamps, and download statuses (`COMPLETED`, `PENDING`, `FAILED`).
- **Resilient Downloader Engine**: Supports HTTP/HTTPS streaming downloads as well as in-browser `blob:` object URL extractions with configurable exponential backoff retries.
- **UI Mismatch Diagnostics**: Automatically captures full-page screenshots and HTML DOM snapshots in `./diagnostics/` if Google Flow changes layout or selector detection fails.
- **Rotating Logs**: Production logging via `winston` and `winston-daily-rotate-file` saved in `./logs/`.
- **Command-Line Interface**: Easy management via `flowdownloader start`, `flowdownloader status`, `flowdownloader launch-chrome`, and `flowdownloader config`.

---

## Quick Start

### 1. Prerequisites
- **OS**: Windows 10/11 (64-bit)
- **Node.js**: v18.x or v20.x or v24.x LTS
- **Google Chrome**: Installed at default location (`C:\Program Files\Google\Chrome\Application\chrome.exe`)

### 2. Installation
```powershell
# Clone the repository & navigate to directory
cd FlowDownloader

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 3. Running FlowDownloader
```powershell
# Start the automation engine
npm run start
```
*On first launch, a Chrome browser window will open. Simply log into your Google account on Google Flow. Once logged in, FlowDownloader will automatically begin monitoring and downloading completed videos.*

---

## Detailed Documentation

- 📖 [Installation Guide](docs/INSTALLATION.md)
- 🏗️ [Architecture & Chrome CDP Security Analysis](docs/ARCHITECTURE.md)
- ⚙️ [Configuration Guide](docs/CONFIGURATION.md)
- 🛠️ [Build & Executable Guide](docs/BUILD.md)
- 🚀 [Future Extension Points](docs/EXTENSIONS.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
