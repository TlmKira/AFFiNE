import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { XMLParser } from 'fast-xml-parser';
import { PDFParse } from 'pdf-parse';

import { BadRequest, ResponseTooLargeError, safeFetch } from '../../base';
import { AccessController } from '../../core/permission';
import { WorkspaceBlobStorage } from '../../core/storage';
import { ResearchCitationService } from '../research-citation/service';
import type { CitationMetadata } from '../research-citation/types';
import type {
  CreateResearchFeedInput,
  ResearchFeedItem,
  ResearchFeedSubscription,
  ResearchFeedType,
  UpdateResearchFeedInput,
} from './types';

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN =
  /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;
const FETCH_TIMEOUT_MS = 12000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_PDF_SCAN_BYTES = 5 * 1024 * 1024;
const MAX_REMOTE_PDF_BYTES = 50 * 1024 * 1024;
const DEFAULT_REFRESH_INTERVAL_MINUTES = 360;
const DUE_FEED_LIMIT = 50;

type FeedEntry = {
  title: string;
  authors: string[];
  url?: string;
  doi?: string;
  arxivId?: string;
  abstract?: string;
  publishedAt?: Date;
  raw: unknown;
};

function clean(value?: string | null) {
  return (
    value
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

function first<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function arrayOf<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeDoi(value?: string | null) {
  return clean(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[).,;]+$/, '');
}

function normalizeArxiv(value?: string | null) {
  return clean(value).match(ARXIV_PATTERN)?.[1]?.replace(/v\d+$/i, '');
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class ResearchLibraryService {
  private readonly logger = new Logger(ResearchLibraryService.name);
  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: 'text',
  });

  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController,
    private readonly storage: WorkspaceBlobStorage,
    private readonly citation: ResearchCitationService
  ) {}

  async recognizePdf(
    userId: string,
    workspaceId: string,
    file: {
      buffer: Buffer;
      mimetype?: string;
      originalname?: string;
      size?: number;
    }
  ): Promise<CitationMetadata & { filename?: string }> {
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');
    if (!file?.buffer?.length) {
      throw new BadRequest('PDF 文件为空。');
    }
    if (file.mimetype && file.mimetype !== 'application/pdf') {
      throw new BadRequest('只支持 PDF 文件。');
    }
    const text = await this.extractPdfText(file.buffer);
    const identifier =
      normalizeDoi(text.match(DOI_PATTERN)?.[0]) || normalizeArxiv(text);
    if (identifier) {
      return {
        ...(await this.citation.resolve(identifier)),
        filename: file.originalname,
      };
    }

    const fallbackTitle = clean(
      file.originalname?.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
    );
    return {
      title: fallbackTitle || '未识别论文',
      provider: 'local',
      confidence: 0.35,
      reliable: false,
      filename: file.originalname,
      url: fallbackTitle
        ? `https://scholar.google.com/scholar?q=${encodeURIComponent(
            fallbackTitle
          )}`
        : undefined,
    };
  }

  async importPdfUrl(
    userId: string,
    input: { workspaceId?: string; url?: string; filename?: string }
  ) {
    const workspaceId = input.workspaceId?.trim();
    const rawUrl = input.url?.trim();
    if (!workspaceId || !rawUrl) {
      throw new BadRequest('workspaceId and url are required.');
    }
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequest('Invalid PDF URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequest('Only http/https PDF URLs are supported.');
    }

    const response = await safeFetch(
      url,
      {
        headers: {
          Accept: 'application/pdf,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 AFFiNE Research PDF Importer',
        },
      },
      {
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRedirects: 4,
        maxBytes: MAX_REMOTE_PDF_BYTES,
      }
    );
    if (!response.ok) {
      throw new BadRequest(`Failed to download PDF: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? '';
    const looksLikePdf = buffer.subarray(0, 5).toString('utf8') === '%PDF-';
    if (!/application\/pdf/i.test(contentType) && !looksLikePdf) {
      throw new BadRequest('The URL did not return a PDF file.');
    }

    const blobId = createHash('sha256').update(buffer).digest('base64url');
    await this.storage.put(workspaceId, blobId, buffer);

    const pdfName =
      clean(input.filename) ||
      this.filenameFromDisposition(
        response.headers.get('content-disposition')
      ) ||
      basename(decodeURIComponent(url.pathname)) ||
      'paper.pdf';

    return {
      pdfBlobId: blobId,
      pdfName: /\.pdf$/i.test(pdfName) ? pdfName : `${pdfName}.pdf`,
      pdfSize: buffer.length,
      mimeType: 'application/pdf',
      sourceUrl: response.url || url.toString(),
    };
  }

  async listFeeds(userId: string, workspaceId: string) {
    await this.ac.user(userId).workspace(workspaceId).assert('Workspace.Read');
    return await this.db.$queryRaw<ResearchFeedSubscription[]>(
      Prisma.sql`
        SELECT
          id,
          workspace_id AS "workspaceId",
          url,
          type,
          title,
          enabled,
          refresh_interval_minutes AS "refreshIntervalMinutes",
          last_sync_at AS "lastSyncAt",
          next_sync_at AS "nextSyncAt",
          last_error AS "lastError",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM research_feed_subscriptions
        WHERE workspace_id = ${workspaceId}
        ORDER BY created_at DESC
      `
    );
  }

  async createFeed(userId: string, input: CreateResearchFeedInput) {
    await this.ac
      .user(userId)
      .workspace(input.workspaceId)
      .assert('Workspace.CreateDoc');
    const url = this.normalizeFeedUrl(input.url);
    const id = randomUUID();
    const type = input.type ?? this.inferFeedType(url);
    const refreshInterval = Math.max(
      15,
      input.refreshIntervalMinutes ?? DEFAULT_REFRESH_INTERVAL_MINUTES
    );
    const [feed] = await this.db.$queryRaw<ResearchFeedSubscription[]>(
      Prisma.sql`
        INSERT INTO research_feed_subscriptions (
          id,
          workspace_id,
          url,
          type,
          title,
          refresh_interval_minutes,
          next_sync_at,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${input.workspaceId},
          ${url},
          ${type},
          ${input.title || null},
          ${refreshInterval},
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (workspace_id, url) DO UPDATE SET
          enabled = TRUE,
          title = COALESCE(EXCLUDED.title, research_feed_subscriptions.title),
          updated_at = NOW()
        RETURNING
          id,
          workspace_id AS "workspaceId",
          url,
          type,
          title,
          enabled,
          refresh_interval_minutes AS "refreshIntervalMinutes",
          last_sync_at AS "lastSyncAt",
          next_sync_at AS "nextSyncAt",
          last_error AS "lastError",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `
    );
    await this.refreshFeed(userId, feed.id);
    return feed;
  }

  async updateFeed(
    userId: string,
    feedId: string,
    input: UpdateResearchFeedInput
  ) {
    const feed = await this.getFeedOrThrow(feedId);
    await this.ac
      .user(userId)
      .workspace(feed.workspaceId)
      .assert('Workspace.CreateDoc');
    const [updated] = await this.db.$queryRaw<ResearchFeedSubscription[]>(
      Prisma.sql`
        UPDATE research_feed_subscriptions
        SET
          title = COALESCE(${input.title ?? null}, title),
          enabled = COALESCE(${input.enabled ?? null}, enabled),
          refresh_interval_minutes = COALESCE(
            ${input.refreshIntervalMinutes ?? null},
            refresh_interval_minutes
          ),
          updated_at = NOW()
        WHERE id = ${feedId}
        RETURNING
          id,
          workspace_id AS "workspaceId",
          url,
          type,
          title,
          enabled,
          refresh_interval_minutes AS "refreshIntervalMinutes",
          last_sync_at AS "lastSyncAt",
          next_sync_at AS "nextSyncAt",
          last_error AS "lastError",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `
    );
    return updated;
  }

  async deleteFeed(userId: string, feedId: string) {
    const feed = await this.getFeedOrThrow(feedId);
    await this.ac
      .user(userId)
      .workspace(feed.workspaceId)
      .assert('Workspace.CreateDoc');
    await this.db.$executeRaw(
      Prisma.sql`DELETE FROM research_feed_subscriptions WHERE id = ${feedId}`
    );
    return { ok: true };
  }

  async listFeedItems(userId: string, workspaceId: string) {
    await this.ac.user(userId).workspace(workspaceId).assert('Workspace.Read');
    const rows = await this.db.$queryRaw<
      Array<Omit<ResearchFeedItem, 'authors'> & { authors: unknown }>
    >(
      Prisma.sql`
        SELECT
          id,
          subscription_id AS "subscriptionId",
          workspace_id AS "workspaceId",
          fingerprint,
          title,
          authors,
          url,
          doi,
          arxiv_id AS "arxivId",
          abstract,
          published_at AS "publishedAt",
          raw,
          imported_doc_id AS "importedDocId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM research_feed_items
        WHERE workspace_id = ${workspaceId}
        ORDER BY COALESCE(published_at, created_at) DESC
        LIMIT 200
      `
    );
    return rows.map(row => ({ ...row, authors: jsonArray(row.authors) }));
  }

  async refreshFeed(userId: string, feedId: string) {
    const feed = await this.getFeedOrThrow(feedId);
    await this.ac
      .user(userId)
      .workspace(feed.workspaceId)
      .assert('Workspace.CreateDoc');
    return await this.refreshFeedRecord(feed);
  }

  async refreshDueFeeds() {
    const feeds = await this.db.$queryRaw<ResearchFeedSubscription[]>(
      Prisma.sql`
        SELECT
          id,
          workspace_id AS "workspaceId",
          url,
          type,
          title,
          enabled,
          refresh_interval_minutes AS "refreshIntervalMinutes",
          last_sync_at AS "lastSyncAt",
          next_sync_at AS "nextSyncAt",
          last_error AS "lastError",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM research_feed_subscriptions
        WHERE enabled = TRUE
          AND (next_sync_at IS NULL OR next_sync_at <= NOW())
        ORDER BY COALESCE(next_sync_at, created_at) ASC
        LIMIT ${DUE_FEED_LIMIT}
      `
    );
    await Promise.allSettled(feeds.map(feed => this.refreshFeedRecord(feed)));
  }

  private async refreshFeedRecord(feed: ResearchFeedSubscription) {
    try {
      const entries = await this.fetchFeedEntries(feed.url, feed.type);
      for (const entry of entries) {
        await this.upsertFeedItem(feed, entry);
      }
      const nextSyncAt = addMinutes(
        new Date(),
        Math.max(15, feed.refreshIntervalMinutes)
      );
      await this.db.$executeRaw(
        Prisma.sql`
          UPDATE research_feed_subscriptions
          SET
            last_sync_at = NOW(),
            next_sync_at = ${nextSyncAt},
            last_error = NULL,
            updated_at = NOW()
          WHERE id = ${feed.id}
        `
      );
      return { imported: entries.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to refresh research feed ${feed.id}: ${message}`
      );
      await this.db.$executeRaw(
        Prisma.sql`
          UPDATE research_feed_subscriptions
          SET
            next_sync_at = ${addMinutes(new Date(), 60)},
            last_error = ${message.slice(0, 500)},
            updated_at = NOW()
          WHERE id = ${feed.id}
        `
      );
      return { imported: 0, error: message };
    }
  }

  private async fetchFeedEntries(url: string, type: ResearchFeedType) {
    const response = await safeFetch(
      url,
      {
        headers: {
          Accept:
            'application/atom+xml, application/rss+xml, application/xml, text/xml',
          'User-Agent': 'AFFiNE Research Feed Reader',
        },
      },
      {
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRedirects: 3,
        maxBytes: MAX_FEED_BYTES,
      }
    );
    if (!response.ok) {
      throw new BadRequest(`订阅源请求失败：${response.status}`);
    }
    const text = await response.text();
    const parsed = this.xml.parse(text) as Record<string, unknown>;
    if (type === 'rss' || parsed.rss) {
      return this.parseRss(parsed);
    }
    return this.parseAtom(parsed);
  }

  private parseRss(parsed: Record<string, unknown>) {
    const channel = (parsed.rss as Record<string, unknown> | undefined)
      ?.channel as Record<string, unknown> | undefined;
    return arrayOf(
      channel?.item as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined
    )
      .map((item): FeedEntry => {
        const title = clean(first(item.title as string | string[] | undefined));
        const link = clean(first(item.link as string | string[] | undefined));
        const description = clean(
          first(item.description as string | string[] | undefined)
        );
        const doi = normalizeDoi(
          first(
            (item['prism:doi'] ?? item.doi ?? '') as
              | string
              | string[]
              | undefined
          )
        );
        return {
          title,
          authors: this.readAuthors(item),
          url: link || undefined,
          doi: doi || undefined,
          arxivId: normalizeArxiv(`${link} ${title} ${description}`),
          abstract: description || undefined,
          publishedAt:
            toDate(
              first(
                (item.pubDate ?? item.published ?? item.updated) as
                  | string
                  | string[]
                  | undefined
              )
            ) ?? undefined,
          raw: item,
        };
      })
      .filter(entry => entry.title);
  }

  private parseAtom(parsed: Record<string, unknown>) {
    const feed = (parsed.feed ?? parsed) as Record<string, unknown>;
    return arrayOf(
      feed.entry as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined
    )
      .map((entry): FeedEntry => {
        const title = clean(
          first(entry.title as string | string[] | undefined)
        );
        const summary = clean(
          first(
            (entry.summary ?? entry.content) as string | string[] | undefined
          )
        );
        const links = arrayOf(
          entry.link as
            | string
            | string[]
            | Record<string, string>
            | Record<string, string>[]
            | undefined
        );
        const href =
          links
            .map(link => (typeof link === 'string' ? link : link.href))
            .find(Boolean) ?? '';
        const id = clean(first(entry.id as string | string[] | undefined));
        return {
          title,
          authors: this.readAuthors(entry),
          url: href || id || undefined,
          doi: normalizeDoi(
            first(
              (entry['prism:doi'] ?? entry.doi ?? '') as
                | string
                | string[]
                | undefined
            )
          ),
          arxivId: normalizeArxiv(`${id} ${href} ${title}`),
          abstract: summary || undefined,
          publishedAt:
            toDate(
              first(
                (entry.published ?? entry.updated) as
                  | string
                  | string[]
                  | undefined
              )
            ) ?? undefined,
          raw: entry,
        };
      })
      .filter(entry => entry.title);
  }

  private readAuthors(entry: Record<string, unknown>) {
    const authorValues = arrayOf(entry.author as unknown);
    return authorValues
      .map(author => {
        if (typeof author === 'string') return clean(author);
        if (!author || typeof author !== 'object') return '';
        const record = author as Record<string, unknown>;
        return clean(
          first((record.name ?? record.text) as string | string[] | undefined)
        );
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  private async upsertFeedItem(
    feed: ResearchFeedSubscription,
    entry: FeedEntry
  ) {
    const fingerprint = this.fingerprint(entry);
    await this.db.$executeRaw(
      Prisma.sql`
        INSERT INTO research_feed_items (
          id,
          subscription_id,
          workspace_id,
          fingerprint,
          title,
          authors,
          url,
          doi,
          arxiv_id,
          abstract,
          published_at,
          raw,
          created_at,
          updated_at
        )
        VALUES (
          ${randomUUID()},
          ${feed.id},
          ${feed.workspaceId},
          ${fingerprint},
          ${entry.title},
          ${JSON.stringify(entry.authors)}::jsonb,
          ${entry.url ?? null},
          ${entry.doi ?? null},
          ${entry.arxivId ?? null},
          ${entry.abstract ?? null},
          ${entry.publishedAt ?? null},
          ${JSON.stringify(entry.raw)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (workspace_id, fingerprint) DO UPDATE SET
          title = EXCLUDED.title,
          authors = EXCLUDED.authors,
          url = COALESCE(EXCLUDED.url, research_feed_items.url),
          doi = COALESCE(EXCLUDED.doi, research_feed_items.doi),
          arxiv_id = COALESCE(EXCLUDED.arxiv_id, research_feed_items.arxiv_id),
          abstract = COALESCE(EXCLUDED.abstract, research_feed_items.abstract),
          published_at = COALESCE(EXCLUDED.published_at, research_feed_items.published_at),
          raw = EXCLUDED.raw,
          updated_at = NOW()
      `
    );
  }

  private async getFeedOrThrow(id: string) {
    const [feed] = await this.db.$queryRaw<ResearchFeedSubscription[]>(
      Prisma.sql`
        SELECT
          id,
          workspace_id AS "workspaceId",
          url,
          type,
          title,
          enabled,
          refresh_interval_minutes AS "refreshIntervalMinutes",
          last_sync_at AS "lastSyncAt",
          next_sync_at AS "nextSyncAt",
          last_error AS "lastError",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM research_feed_subscriptions
        WHERE id = ${id}
      `
    );
    if (!feed) {
      throw new BadRequest('订阅源不存在。');
    }
    return feed;
  }

  private normalizeFeedUrl(raw: string) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequest('订阅源地址无效。');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BadRequest('订阅源只支持 http:// 或 https://。');
    }
    url.hash = '';
    return url.toString();
  }

  private inferFeedType(url: string): ResearchFeedType {
    return /arxiv\.org/i.test(url) ? 'arxiv' : 'rss';
  }

  private fingerprint(entry: FeedEntry) {
    const key =
      entry.doi ||
      entry.arxivId ||
      entry.url ||
      `${entry.title}:${entry.authors[0] ?? ''}:${entry.publishedAt?.getFullYear() ?? ''}`;
    return createHash('sha256').update(key.toLowerCase()).digest('hex');
  }

  private filenameFromDisposition(disposition?: string | null) {
    if (!disposition) return '';
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (utf8) {
      try {
        return decodeURIComponent(utf8);
      } catch {
        return utf8;
      }
    }
    return disposition.match(/filename="?([^";]+)"?/i)?.[1]?.trim() ?? '';
  }

  private async extractPdfText(buffer: Buffer) {
    if (buffer.byteLength > MAX_PDF_SCAN_BYTES) {
      throw new ResponseTooLargeError({
        limitBytes: MAX_PDF_SCAN_BYTES,
        receivedBytes: buffer.byteLength,
      });
    }
    try {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText({ first: 5 });
        return result.text.replace(/\s+/g, ' ');
      } finally {
        await parser.destroy();
      }
    } catch (error) {
      this.logger.debug(
        'Failed to parse PDF text, falling back to byte scan',
        error instanceof Error ? error.message : error
      );
      return buffer
        .toString('latin1')
        .replace(/\\([()\\])/g, '$1')
        .replace(/[^\x20-\x7e]+/g, ' ')
        .replace(/\s+/g, ' ');
    }
  }
}
