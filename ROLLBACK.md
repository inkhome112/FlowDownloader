# Rollback Guide for FlowDownloader

This document tracks all official restore point tags created in Git so you can easily revert to any working milestone version.

---

## Restore Points List

| Tag Name | Release Date | Description |
| :--- | :--- | :--- |
| **`v1.2.0-restorepoint`** | **2026-08-04** | **Stable v1.2 Release** (Includes Web GUI Dashboard, Date Filtering, Native Video Frame Thumbnails, Hover Video Preview, Storage Quota Engine, Single-Tab Launcher). |
| `v1.0.0-restorepoint` | 2026-08-02 | Initial v1.0.0 Core Restore Point. |

---

## How to Rollback to `v1.2.0-restorepoint`

If you ever want to revert the codebase back to this stable **v1.2.0** restore point, open Command Prompt or PowerShell in your project folder and run:

```powershell
# 1. Discard any local modifications and reset working directory to v1.2.0-restorepoint
git reset --hard v1.2.0-restorepoint

# 2. Rebuild TypeScript files cleanly
npm run build
```

---

## How to Rollback to Initial `v1.0.0-restorepoint`

```powershell
git reset --hard v1.0.0-restorepoint
npm run build
```

---

## List All Available Restore Points
```powershell
git tag -l
```
