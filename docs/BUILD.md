# FlowDownloader Build & Executable Instructions

This document provides instructions for compiling FlowDownloader and packaging it into a standalone Windows executable (`.exe`).

---

## 1. Standard TypeScript Build

To compile TypeScript source files into JavaScript in the `./dist` directory:

```powershell
npm run build
```

This compiles all files in `src/` into CommonJS JavaScript in `dist/`.

---

## 2. Packaging Standalone Windows Executable (`.exe`)

FlowDownloader includes `pkg` configuration in `package.json` for creating standalone Windows binaries.

### Step 1: Run Packaging Script
```powershell
npm run pack:win
```

### Step 2: Output Location
The compiled Windows executable will be generated at:
```
d:\FlowDownloader\dist-bin\flowdownloader.exe
```

---

## 3. Running the Standalone Executable

Once built, `flowdownloader.exe` can be distributed along with `config.json`.

```powershell
# Display status
.\dist-bin\flowdownloader.exe status

# Launch automation engine
.\dist-bin\flowdownloader.exe start

# Launch Chrome for CDP mode
.\dist-bin\flowdownloader.exe launch-chrome
```
