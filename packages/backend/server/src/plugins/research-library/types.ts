import type { CitationMetadata } from '../research-citation/types';

export type ResearchFeedType = 'rss' | 'atom' | 'arxiv';

export type ResearchFeedSubscription = {
  id: string;
  workspaceId: string;
  url: string;
  type: ResearchFeedType;
  title: string | null;
  enabled: boolean;
  refreshIntervalMinutes: number;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  publishedAt: Date | null;
  raw: unknown;
  importedDocId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateResearchFeedInput = {
  workspaceId: string;
  url: string;
  title?: string;
  type?: ResearchFeedType;
  refreshIntervalMinutes?: number;
};

export type UpdateResearchFeedInput = {
  title?: string;
  enabled?: boolean;
  refreshIntervalMinutes?: number;
};

export type RecognizedPaper = CitationMetadata & {
  filename?: string;
};
