export type CitationResolveRequest = {
  input?: string;
};

export type CitationTranslateUrlRequest = {
  url?: string;
};

export type CitationTranslateHtmlRequest = {
  url?: string;
  html?: string;
};

export type CitationProviderName =
  | 'local'
  | 'crossref'
  | 'datacite'
  | 'openalex'
  | 'arxiv'
  | 'semantic-scholar'
  | 'url'
  | 'zotero-translator'
  | 'google-scholar'
  | 'cnki'
  | 'baidu-scholar'
  | 'generic-meta';

export type CitationAttachment = {
  title?: string;
  url?: string;
  mimeType?: string;
};

export type CitationMetadata = {
  title: string;
  authors?: string[];
  year?: string;
  source?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  attachments?: CitationAttachment[];
  provider: CitationProviderName;
  confidence: number;
  reliable: boolean;
};

export type CitationTranslationCandidate = {
  id: string;
  title: string;
  url?: string;
  metadata?: CitationMetadata;
};

export type CitationTranslationResult =
  | {
      kind: 'single';
      translator: string;
      metadata: CitationMetadata;
    }
  | {
      kind: 'multiple';
      translator: string;
      items: CitationTranslationCandidate[];
    };
