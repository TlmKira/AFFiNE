export type ResearchPaperStatus =
  | 'to-read'
  | 'skimming'
  | 'reading'
  | 'reproducing'
  | 'cited'
  | 'archived';

export type ResearchPaperMetadata = {
  title: string;
  authors?: string[];
  year?: string;
  source?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  pdfBlobId?: string;
  pdfName?: string;
  pdfSize?: number;
  pdfAttachmentBlockId?: string;
  tags?: string[];
  status: ResearchPaperStatus;
  createdFrom: 'manual' | 'pdf' | 'feed';
  addedAt: string;
  lastReadAt?: string;
};

export type ResearchFeedSubscription = {
  id: string;
  workspaceId: string;
  url: string;
  type: 'rss' | 'atom' | 'arxiv';
  title: string | null;
  enabled: boolean;
  refreshIntervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
};

export type ResearchFeedItem = {
  id: string;
  subscriptionId: string;
  workspaceId: string;
  fingerprint: string;
  title: string;
  authors: string[];
  url: string | null;
  doi: string | null;
  arxivId: string | null;
  abstract: string | null;
  publishedAt: string | null;
  importedDocId: string | null;
};

export type ResearchPaperDuplicateResult =
  | { duplicated: false }
  | { duplicated: true; docId: string; reason: 'doi' | 'arxiv' | 'url' };

export const PAPER_STATUS_LABELS: Record<ResearchPaperStatus, string> = {
  'to-read': '待读',
  skimming: '略读',
  reading: '精读',
  reproducing: '复现中',
  cited: '已引用',
  archived: '归档',
};

export const PAPER_STATUS_ORDER: ResearchPaperStatus[] = [
  'to-read',
  'skimming',
  'reading',
  'reproducing',
  'cited',
  'archived',
];
