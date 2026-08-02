export interface AppConfig {
  flowUrl: string;
  downloadFolder: string;
  pollIntervalMs: number;
  browserStrategy: 'auto' | 'persistent' | 'cdp';
  chromeExecutablePath: string;
  cdpPort: number;
  userDataDir: string;
  headless: boolean;
  maxRetries: number;
  autoScrollOnPoll: boolean;
  enableWebDashboard?: boolean;
  webPort?: number;
  enableDesktopNotifications?: boolean;
  fileTemplate?: string;
  generateThumbnails?: boolean;
  autoOpenWebBrowser?: boolean;
  dateFilterMode?: 'TODAY' | 'ALL' | 'SPECIFIC';
  specificDate?: string;
  enableAutoArchiving?: boolean;
  maxStorageGb?: number;
  autoArchiveDays?: number;
  hoverVideoPreview?: boolean;
}

export interface VideoRecord {
  id: string;
  prompt: string;
  download_status: 'PENDING' | 'COMPLETED' | 'FAILED';
  download_date?: string;
  filename?: string;
  filepath?: string;
  thumbnail_path?: string;
  filesize?: number;
  checksum?: string;
  retry_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DetectedVideoItem {
  id: string;
  prompt: string;
  videoUrl?: string;
  status: 'READY' | 'PROCESSING' | 'FAILED';
  dateString?: string;
}
