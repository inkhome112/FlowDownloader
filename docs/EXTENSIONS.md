# FlowDownloader Future Extension Points

FlowDownloader is architected for modular expansion. Below are recommended extension points for future feature additions:

---

## 1. Webhook & Notification System
- **Module Target**: `src/notifications/`
- **Extension Point**: Add event hooks in `VideoDownloader` (e.g. `onVideoDownloaded`) to dispatch notifications to Discord, Slack, Telegram, or custom webhooks when new video generations finish downloading.

## 2. Cloud Backup & Storage Sync
- **Module Target**: `src/storage/CloudUploader.ts`
- **Extension Point**: Extend `VideoDownloader` to automatically upload completed `.mp4` videos to Google Drive, AWS S3, Cloudflare R2, or Dropbox upon download completion.

## 3. Web Dashboard & REST API
- **Module Target**: `src/web/`
- **Extension Point**: Embed an Express or Fastify web server exposing REST endpoints for download status, video preview streaming, and web UI monitoring.

## 4. Multi-Account Profile Manager
- **Module Target**: `src/browser/ProfileManager.ts`
- **Extension Point**: Allow configuring multiple user profile directories in `config.json` (`userDataDir_Account1`, `userDataDir_Account2`) to poll generations across multiple Google accounts sequentially or concurrently.

## 5. Automated Prompt Generation Triggering
- **Module Target**: `src/flow/FlowGenerator.ts`
- **Extension Point**: Extend `FlowDetector` to support submitting prompt generation batches directly to Google Flow via UI interaction or internal API calls.
