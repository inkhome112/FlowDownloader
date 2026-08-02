export interface DetectedFlowItem {
  id: string;
  prompt: string;
  videoUrl?: string;
  status: 'completed' | 'generating' | 'failed';
  timestamp?: string;
  dateString?: string;
  rawElementInfo?: string;
}
