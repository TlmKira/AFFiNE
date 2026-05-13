export type CitationResolveRequest = {
  input?: string;
};

export type CitationProviderName =
  | 'local'
  | 'crossref'
  | 'datacite'
  | 'openalex'
  | 'arxiv'
  | 'semantic-scholar'
  | 'url';

export type CitationMetadata = {
  title: string;
  authors?: string[];
  year?: string;
  source?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  provider: CitationProviderName;
  confidence: number;
  reliable: boolean;
};
