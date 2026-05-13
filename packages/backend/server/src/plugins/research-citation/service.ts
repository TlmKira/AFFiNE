import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { HTMLRewriter } from 'htmlrewriter';

import {
  BadRequest,
  Cache,
  Config,
  ResponseTooLargeError,
  safeFetch,
  SsrfBlockedError,
} from '../../base';
import type { CitationMetadata } from './types';

const CACHE_TTL = 1000 * 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_METADATA_BYTES = 1024 * 1024;
const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN =
  /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;

type MaybeCitation = Omit<CitationMetadata, 'reliable'>;

function clean(value?: string | null) {
  return (
    value
      ?.replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

function first<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDoi(raw: string) {
  return raw
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .replace(/[).,;]+$/, '');
}

function normalizeArxivId(raw: string) {
  const match = raw.match(ARXIV_PATTERN);
  return match?.[1]?.trim();
}

function words(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function titleConfidence(query: string, title?: string) {
  if (!title) return 0;
  const normalizedQuery = clean(query).toLowerCase();
  const normalizedTitle = clean(title).toLowerCase();
  if (normalizedQuery === normalizedTitle) return 0.98;
  if (
    normalizedQuery.length > 12 &&
    normalizedTitle.includes(normalizedQuery)
  ) {
    return 0.92;
  }
  const queryWords = new Set(words(query));
  const titleWords = new Set(words(title));
  if (queryWords.size === 0 || titleWords.size === 0) return 0;
  let overlap = 0;
  queryWords.forEach(word => {
    if (titleWords.has(word)) overlap += 1;
  });
  return Math.min(0.9, overlap / queryWords.size);
}

function authorsFromCrossref(authors: unknown) {
  if (!Array.isArray(authors)) return undefined;
  return authors
    .map(author => {
      if (!author || typeof author !== 'object') return '';
      const record = author as Record<string, string | undefined>;
      return clean(
        [record.given, record.family].filter(Boolean).join(' ') ||
          record.name ||
          ''
      );
    })
    .filter(Boolean)
    .slice(0, 8);
}

function abstractFromOpenAlex(
  inverted?: Record<string, number[]> | null
): string | undefined {
  if (!inverted) return undefined;
  const entries = Object.entries(inverted).flatMap(([word, indexes]) =>
    indexes.map(index => [index, word] as const)
  );
  return entries
    .sort(([a], [b]) => a - b)
    .map(([, word]) => word)
    .join(' ');
}

@Injectable()
export class ResearchCitationService {
  private readonly logger = new Logger(ResearchCitationService.name);
  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: 'text',
  });

  constructor(
    private readonly cache: Cache,
    private readonly config: Config
  ) {}

  async resolve(input: string): Promise<CitationMetadata> {
    const cacheKey = `research-citation:${input.trim().toLowerCase()}`;
    const cached = await this.cache.get<CitationMetadata>(cacheKey);
    if (cached) return cached;

    const resolved =
      (await this.resolveBibTeX(input)) ??
      (await this.resolveDoiInput(input)) ??
      (await this.resolveArxivInput(input)) ??
      (await this.resolveUrlInput(input)) ??
      (await this.resolveTitleInput(input)) ??
      this.localFallback(input);

    await this.cache.set(cacheKey, resolved, { ttl: CACHE_TTL });
    return resolved;
  }

  private headers(provider: 'crossref' | 'openalex' | 'semantic' | 'default') {
    const contactEmail = this.config.researchCitation.contactEmail;
    const product = contactEmail
      ? `AFFiNE Research Citation Resolver (mailto:${contactEmail})`
      : 'AFFiNE Research Citation Resolver';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': product,
    };
    if (
      provider === 'semantic' &&
      this.config.researchCitation.semanticScholarApiKey
    ) {
      headers['x-api-key'] = this.config.researchCitation.semanticScholarApiKey;
    }
    return headers;
  }

  private withReliability(
    candidate: MaybeCitation | null
  ): CitationMetadata | null {
    if (!candidate?.title) return null;
    return {
      ...candidate,
      title: clean(candidate.title),
      abstract: clean(candidate.abstract),
      reliable: candidate.confidence >= 0.72,
    };
  }

  private async fetchJson<T>(
    url: string,
    provider: Parameters<typeof this.headers>[0]
  ) {
    const response = await safeFetch(
      url,
      { headers: this.headers(provider) },
      {
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRedirects: MAX_REDIRECTS,
        maxBytes: MAX_METADATA_BYTES,
      }
    );
    if (!response.ok) return null;
    return (await response.json()) as T;
  }

  private async resolveDoiInput(input: string) {
    const doiMatch = input.match(DOI_PATTERN);
    if (!doiMatch && !/^https?:\/\/(?:dx\.)?doi\.org\//i.test(input)) {
      return null;
    }
    const doi = normalizeDoi(doiMatch?.[0] ?? input);
    return (
      (await this.resolveCrossrefDoi(doi)) ??
      (await this.resolveDataCiteDoi(doi)) ??
      (await this.resolveOpenAlexDoi(doi)) ??
      this.withReliability({
        title: `DOI ${doi}`,
        doi,
        url: `https://doi.org/${doi}`,
        provider: 'local',
        confidence: 0.45,
      })
    );
  }

  private async resolveCrossrefDoi(doi: string) {
    try {
      const json = await this.fetchJson<{
        message?: Record<string, unknown>;
      }>(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        'crossref'
      );
      const item = json?.message;
      if (!item) return null;
      const issued = item.issued as { ['date-parts']?: number[][] } | undefined;
      return this.withReliability({
        title: clean(first(item.title as string[] | undefined)),
        authors: authorsFromCrossref(item.author),
        year: issued?.['date-parts']?.[0]?.[0]?.toString(),
        source: clean(first(item['container-title'] as string[] | undefined)),
        doi: clean((item.DOI as string | undefined) ?? doi),
        url: clean(
          (item.URL as string | undefined) ?? `https://doi.org/${doi}`
        ),
        abstract: clean(item.abstract as string | undefined),
        provider: 'crossref',
        confidence: 0.98,
      });
    } catch (error) {
      this.logProviderFailure('Crossref DOI lookup failed', error);
      return null;
    }
  }

  private async resolveDataCiteDoi(doi: string) {
    try {
      const json = await this.fetchJson<{
        data?: { attributes?: Record<string, unknown> };
      }>(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, 'default');
      const attributes = json?.data?.attributes;
      if (!attributes) return null;
      const titles = attributes.titles as { title?: string }[] | undefined;
      const creators = attributes.creators as
        | { name?: string; givenName?: string; familyName?: string }[]
        | undefined;
      const container =
        (attributes.container as { title?: string } | undefined)?.title ||
        (attributes.publisher as string | undefined);
      return this.withReliability({
        title: clean(first(titles)?.title),
        authors: creators
          ?.map(author =>
            clean(
              author.name ||
                [author.givenName, author.familyName].filter(Boolean).join(' ')
            )
          )
          .filter(Boolean)
          .slice(0, 8),
        year: clean(String(attributes.publicationYear ?? '')),
        source: clean(container),
        doi,
        url: clean(
          (attributes.url as string | undefined) ?? `https://doi.org/${doi}`
        ),
        provider: 'datacite',
        confidence: 0.94,
      });
    } catch (error) {
      this.logProviderFailure('DataCite DOI lookup failed', error);
      return null;
    }
  }

  private async resolveOpenAlexDoi(doi: string) {
    return this.resolveOpenAlex(
      `https://api.openalex.org/works?filter=doi:${encodeURIComponent(
        `https://doi.org/${doi}`
      )}&per-page=1`,
      0.88
    );
  }

  private async resolveArxivInput(input: string) {
    const arxivId = normalizeArxivId(input);
    if (!arxivId) return null;
    return (
      (await this.resolveArxivApi(arxivId)) ??
      (await this.resolveSemanticScholar(`ARXIV:${arxivId}`, 0.84)) ??
      (await this.resolveOpenAlex(
        `https://api.openalex.org/works?filter=locations.source.id:s4306400194&search=${encodeURIComponent(
          arxivId
        )}&per-page=1`,
        0.72
      )) ??
      this.withReliability({
        title: `arXiv ${arxivId}`,
        arxivId,
        url: `https://arxiv.org/abs/${arxivId}`,
        provider: 'local',
        confidence: 0.45,
      })
    );
  }

  private async resolveArxivApi(arxivId: string) {
    try {
      const response = await safeFetch(
        `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(
          arxivId
        )}`,
        { headers: { 'User-Agent': this.headers('default')['User-Agent'] } },
        {
          timeoutMs: FETCH_TIMEOUT_MS,
          maxRedirects: MAX_REDIRECTS,
          maxBytes: MAX_METADATA_BYTES,
        }
      );
      if (!response.ok) return null;
      const parsed = this.xml.parse(await response.text()) as {
        feed?: { entry?: Record<string, unknown> | Record<string, unknown>[] };
      };
      const entry = first(parsed.feed?.entry);
      if (!entry || !entry.title) return null;
      const authors = entry.author
        ? (Array.isArray(entry.author) ? entry.author : [entry.author])
            .map(author =>
              clean(
                typeof author === 'object' && author
                  ? String((author as { name?: string }).name ?? '')
                  : String(author)
              )
            )
            .filter(Boolean)
        : undefined;
      return this.withReliability({
        title: clean(String(entry.title)),
        authors,
        year: clean(String(entry.published ?? '')).slice(0, 4),
        source: clean(String(entry.journal_ref ?? 'arXiv')),
        doi: clean(String(entry.doi ?? '')),
        arxivId,
        url: clean(String(entry.id ?? `https://arxiv.org/abs/${arxivId}`)),
        abstract: clean(String(entry.summary ?? '')),
        provider: 'arxiv',
        confidence: 0.98,
      });
    } catch (error) {
      this.logProviderFailure('arXiv lookup failed', error);
      return null;
    }
  }

  private async resolveUrlInput(input: string) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    const doi = input.match(DOI_PATTERN)?.[0];
    if (doi || /doi\.org/i.test(url.hostname)) {
      return await this.resolveDoiInput(input);
    }
    if (/arxiv\.org/i.test(url.hostname)) {
      return await this.resolveArxivInput(input);
    }
    return await this.resolveUrlMetadata(url);
  }

  private async resolveUrlMetadata(url: URL) {
    try {
      const response = await safeFetch(
        url.toString(),
        { headers: { 'User-Agent': this.headers('default')['User-Agent'] } },
        {
          timeoutMs: FETCH_TIMEOUT_MS,
          maxRedirects: MAX_REDIRECTS,
          maxBytes: MAX_METADATA_BYTES,
        }
      );
      if (!response.ok || !response.body) return null;
      const metadata: {
        title?: string;
        description?: string;
        authors: string[];
        year?: string;
        source?: string;
        doi?: string;
      } = { authors: [] };
      const body = Buffer.from(await response.arrayBuffer());
      const rewriter = new HTMLRewriter()
        .on('title', {
          text(text) {
            if (!metadata.title) metadata.title = text.text;
          },
        })
        .on('meta', {
          element(element) {
            const key = (
              element.getAttribute('name') ??
              element.getAttribute('property') ??
              ''
            ).toLowerCase();
            const content = clean(element.getAttribute('content'));
            if (!content) return;
            if (key === 'citation_title' || key === 'og:title') {
              metadata.title = metadata.title || content;
            }
            if (key === 'citation_author') {
              metadata.authors.push(content);
            }
            if (key === 'citation_publication_date') {
              metadata.year = metadata.year || content.slice(0, 4);
            }
            if (
              key === 'citation_journal_title' ||
              key === 'citation_conference_title'
            ) {
              metadata.source = metadata.source || content;
            }
            if (key === 'citation_doi') {
              metadata.doi = metadata.doi || normalizeDoi(content);
            }
            if (key === 'description' || key === 'og:description') {
              metadata.description = metadata.description || content;
            }
          },
        });
      await rewriter.transform(new Response(body, response)).text();
      if (metadata.doi) {
        return (await this.resolveDoiInput(metadata.doi)) ?? null;
      }
      return this.withReliability({
        title: clean(metadata.title ?? url.hostname.replace(/^www\./, '')),
        authors: metadata.authors.slice(0, 8),
        year: metadata.year,
        source: metadata.source || url.hostname.replace(/^www\./, ''),
        url: response.url || url.toString(),
        abstract: metadata.description,
        provider: 'url',
        confidence: metadata.title ? 0.62 : 0.35,
      });
    } catch (error) {
      if (
        error instanceof SsrfBlockedError ||
        error instanceof ResponseTooLargeError
      ) {
        throw new BadRequest('无法安全读取该网页。');
      }
      this.logProviderFailure('URL metadata lookup failed', error);
      return null;
    }
  }

  private async resolveTitleInput(input: string) {
    return (
      (await this.resolveOpenAlexTitle(input)) ??
      (await this.resolveCrossrefTitle(input)) ??
      (await this.resolveSemanticScholarTitle(input))
    );
  }

  private async resolveOpenAlexTitle(input: string) {
    const result = await this.resolveOpenAlex(
      `https://api.openalex.org/works?search=${encodeURIComponent(
        input
      )}&per-page=1`,
      0.7
    );
    if (!result) return null;
    const confidence = titleConfidence(input, result.title);
    return confidence >= 0.72
      ? { ...result, confidence, reliable: true }
      : null;
  }

  private async resolveOpenAlex(url: string, confidence: number) {
    try {
      const separator = url.includes('?') ? '&' : '?';
      const apiKey = this.config.researchCitation.openAlexApiKey;
      const requestUrl = apiKey
        ? `${url}${separator}api_key=${encodeURIComponent(apiKey)}`
        : url;
      const json = await this.fetchJson<{
        results?: Record<string, unknown>[];
      }>(requestUrl, 'openalex');
      const item = first(json?.results);
      if (!item) return null;
      const primary = item.primary_location as
        | { source?: { display_name?: string } }
        | undefined;
      const authorships = item.authorships as
        | { author?: { display_name?: string } }[]
        | undefined;
      return this.withReliability({
        title: clean(item.title as string | undefined),
        authors: authorships
          ?.map(author => clean(author.author?.display_name))
          .filter(Boolean)
          .slice(0, 8),
        year: clean(String(item.publication_year ?? '')),
        source: clean(primary?.source?.display_name),
        doi: normalizeDoi(clean(item.doi as string | undefined)),
        url: clean(
          (item.doi as string | undefined) ||
            (item.id as string | undefined) ||
            ''
        ),
        abstract: abstractFromOpenAlex(
          item.abstract_inverted_index as Record<string, number[]> | undefined
        ),
        provider: 'openalex',
        confidence,
      });
    } catch (error) {
      this.logProviderFailure('OpenAlex lookup failed', error);
      return null;
    }
  }

  private async resolveCrossrefTitle(input: string) {
    try {
      const json = await this.fetchJson<{
        message?: { items?: Record<string, unknown>[] };
      }>(
        `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(
          input
        )}&rows=1`,
        'crossref'
      );
      const item = first(json?.message?.items);
      if (!item) return null;
      const title = clean(first(item.title as string[] | undefined));
      const confidence = titleConfidence(input, title);
      if (confidence < 0.72) return null;
      const issued = item.issued as { ['date-parts']?: number[][] } | undefined;
      return this.withReliability({
        title,
        authors: authorsFromCrossref(item.author),
        year: issued?.['date-parts']?.[0]?.[0]?.toString(),
        source: clean(first(item['container-title'] as string[] | undefined)),
        doi: clean(item.DOI as string | undefined),
        url: clean(item.URL as string | undefined),
        abstract: clean(item.abstract as string | undefined),
        provider: 'crossref',
        confidence,
      });
    } catch (error) {
      this.logProviderFailure('Crossref title lookup failed', error);
      return null;
    }
  }

  private async resolveSemanticScholarTitle(input: string) {
    try {
      const json = await this.fetchJson<{
        data?: Record<string, unknown>[];
      }>(
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
          input
        )}&limit=1&fields=title,authors,year,venue,url,abstract,externalIds`,
        'semantic'
      );
      const item = first(json?.data);
      if (!item) return null;
      const title = clean(item.title as string | undefined);
      const confidence = titleConfidence(input, title);
      if (confidence < 0.72) return null;
      return this.semanticItemToCitation(item, confidence);
    } catch (error) {
      this.logProviderFailure('Semantic Scholar title lookup failed', error);
      return null;
    }
  }

  private async resolveSemanticScholar(identifier: string, confidence: number) {
    try {
      const json = await this.fetchJson<Record<string, unknown>>(
        `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(
          identifier
        )}?fields=title,authors,year,venue,url,abstract,externalIds`,
        'semantic'
      );
      if (!json) return null;
      return this.semanticItemToCitation(json, confidence);
    } catch (error) {
      this.logProviderFailure('Semantic Scholar lookup failed', error);
      return null;
    }
  }

  private semanticItemToCitation(
    item: Record<string, unknown>,
    confidence: number
  ) {
    const externalIds = item.externalIds as
      | { DOI?: string; ArXiv?: string; PubMed?: string }
      | undefined;
    const authors = item.authors as { name?: string }[] | undefined;
    return this.withReliability({
      title: clean(item.title as string | undefined),
      authors: authors
        ?.map(author => clean(author.name))
        .filter(Boolean)
        .slice(0, 8),
      year: clean(String(item.year ?? '')),
      source: clean(item.venue as string | undefined),
      doi: clean(externalIds?.DOI),
      arxivId: clean(externalIds?.ArXiv),
      url: clean(item.url as string | undefined),
      abstract: clean(item.abstract as string | undefined),
      provider: 'semantic-scholar',
      confidence,
    });
  }

  private async resolveBibTeX(input: string) {
    if (!input.trim().startsWith('@')) return null;
    const read = (field: string) => {
      const match = input.match(
        new RegExp(`${field}\\s*=\\s*[{\"]([^}\"]+)`, 'i')
      );
      return clean(match?.[1]);
    };
    const doi = read('doi');
    if (doi) {
      return (await this.resolveDoiInput(doi)) ?? null;
    }
    const title = read('title');
    if (!title) return null;
    return this.withReliability({
      title,
      authors: read('author')
        .split(/\s+and\s+/i)
        .map(clean)
        .filter(Boolean),
      year: read('year'),
      source: read('journal') || read('booktitle') || read('publisher'),
      url: read('url'),
      provider: 'local',
      confidence: 0.82,
    });
  }

  private localFallback(input: string): CitationMetadata {
    return {
      title: clean(input) || '未命名论文',
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(input)}`,
      provider: 'local',
      confidence: 0.3,
      reliable: false,
    };
  }

  private logProviderFailure(message: string, error: unknown) {
    this.logger.debug(message, error instanceof Error ? error.message : error);
  }
}
