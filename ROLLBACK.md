# Rollback Guide for FlowDownloader

A restore point tag `v1.0.0-restorepoint` has been created in Git before starting the Phase 1-3 upgrades.

If you ever want to revert the codebase back to the initial working v1.0.0 core version, run the following commands in PowerShell or Command Prompt:

```powershell
# 1. Reset working directory to the restore point tag
git reset --hard v1.0.0-restorepoint

# 2. Re-install original dependencies if needed
npm install

# 3. Rebuild TypeScript files
npm run build
```

To view all available tags/restore points:
```powershell
git tag -l
```
