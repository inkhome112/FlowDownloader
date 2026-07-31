# FlowDownloader Installation Guide

This document covers step-by-step instructions for installing and running FlowDownloader on Windows.

---

## 1. System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Node.js**: Node.js 18.x LTS, 20.x LTS, or 24.x
- **Package Manager**: npm 9+
- **Browser**: Google Chrome (installed at `C:\Program Files\Google\Chrome\Application\chrome.exe` or custom path specified in `config.json`)

---

## 2. Installation Steps

### Step 1: Extract or Clone Repository
Open PowerShell or Command Prompt and navigate to your target folder:
```powershell
cd D:\FlowDownloader
```

### Step 2: Install Node.js Dependencies
Run npm install:
```powershell
cmd /c "npm install"
```
*Note: On Windows systems with strict ExecutionPolicies, executing npm via `cmd /c "npm install"` or `npx.cmd` avoids PowerShell script policy blocks.*

### Step 3: Compile TypeScript Codebase
```powershell
npm run build
```

### Step 4: Run Unit Tests (Optional Verification)
```powershell
npm test
```
*Confirms SQLite database, FileUtils, and ConfigManager are operating correctly.*

---

## 3. Initial Launch & Manual Authentication

Run the application:
```powershell
npm run start
```

1. FlowDownloader will initialize SQLite (`./data/flowdownloader.db`) and launch Google Chrome in headful mode using the dedicated user profile directory `./user_data`.
2. A Google Chrome window will open to `https://labs.google/flow`.
3. **Manual Sign-in**: Log into your Google account in this Chrome window.
4. Once signed in, FlowDownloader detects authentication completion and begins scanning the feed for completed video generations.
5. All session cookies and tokens are safely saved inside `./user_data` for subsequent automated runs.
