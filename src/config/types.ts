export type BrowserStrategyType = 'auto' | 'persistent' | 'cdp';

export interface AppConfig {
  downloadFolder: string;
  pollIntervalMs: number;
  retryCount: number;
  headless: boolean;
  browserStrategy: BrowserStrategyType;
  cdpPort: number;
  chromeExecutablePath: string;
  userDataDir: string;
  flowUrl: string;
  autoScrollOnPoll?: boolean;
  enableWebDashboard?: boolean;
  webPort?: number;
  enableDesktopNotifications?: boolean;
  fileTemplate?: string;
  generateThumbnails?: boolean;
}

export interface VideoRecord {
  id: string;
  prompt: string;
  download_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
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

export interface FlowItem {
  id: string;
  prompt: string;
  videoUrl?: string;
  status: 'completed' | 'generating' | 'failed';
  timestamp?: string;
  metadata?: Record<string, any>;
}
