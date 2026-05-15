import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Injectable } from '@nestjs/common';

import { BadRequest, ResponseTooLargeError, safeFetch } from '../../base';
import {
  cleanCitationText,
  normalizeCitationDoi,
  parseRefWorksCitation,
  parseRisCitation,
} from './citation-format';
import type {
  CitationMetadata,
  CitationProviderName,
  CitationTranslationCandidate,
  CitationTranslationResult,
} from './types';
import { ResearchZoteroRuntimeService } from './zotero-runtime';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_TRANSLATOR_BYTES = 2 * 1024 * 1024;
const ZOTERO_TRANSLATOR_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/zotero-translators'
);

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN =
  /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;

export type ZoteroTranslatorManifest = {
  translatorID: string;
  label: string;
  target: string;
  priority: number;
  translatorType?: number;
  lastUpdated?: string;
  file?: string;
};

function clean(value?: string | null) {
  return cleanCitationText(value);
}

function cleanTitle(value?: string | null) {
  return clean(value)
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*-\s*Google Scholar$/i, '')
    .replace(/\s*_\s*百度学术$/i, '')
    .trim();
}

function normalizeArxivId(value?: string | null) {
  return clean(value).match(ARXIV_PATTERN)?.[1]?.replace(/v\d+$/i, '');
}

function absoluteUrl(value: string | undefined, base: URL) {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

function attr(html: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  return html.match(pattern)?.[1];
}

function uniqCandidates(items: CitationTranslationCandidate[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.url ?? ''}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readTranslatorHeader(source: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;
  let start = -1;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (!started) {
      if (/\s/.test(char)) continue;
      if (char !== '{') return null;
      started = true;
      start = index;
      depth = 1;
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function toMetadata(
  input: Partial<CitationMetadata> & { title: string },
  provider: CitationProviderName,
  confidence: number
): CitationMetadata {
  return {
    ...input,
    title: cleanTitle(input.title) || input.title,
    authors: input.authors?.map(clean).filter(Boolean).slice(0, 16),
    doi: normalizeCitationDoi(input.doi),
    arxivId: normalizeArxivId(input.arxivId),
    provider,
    confidence,
    reliable: confidence >= 0.72,
  };
}

export function cnkiExportHtmlToRefWorks(body: string) {
  // This is the CNKI export normalization from Zotero's CNKI translator,
  // reduced to the RefWorks path the server importer uses.
  return body
    .replace("<ul class='literature-list'><li>", '')
    .replace('<br></li></ul>', '')
    .replace('</li><li>', '')
    .replace(/<br>|\r/g, '\n')
    .replace(/vo (\d+)\n/, 'VO $1\n')
    .replace(/IS (\d+)\nvo/, 'IS $1\nVO')
    .replace(/IS 0(\d+)\n/g, 'IS $1\n')
    .replace(/VO 0(\d+)\n/g, 'VO $1\n')
    .replace(/\n+/g, '\n')
    .replace(/\n([A-Z][A-Z1-9]\s)/g, '<br>$1')
    .replace(/\n/g, '')
    .replace(/<br>/g, '\n')
    .replace(/(K1 .*[\u4e00-\u9fa5]) ([a-zA-Z])/g, '$1;$2')
    .replace(/\t/g, '')
    .replace(/^RT\s+Conference Proceeding/gim, 'RT Conference Proceedings')
    .replace(/^RT\s+Dissertation\/Thesis/gim, 'RT Dissertation')
    .replace(/^(A[1-4]|U2)\s*([^\r\n]+)/gm, (_m, tag, authors: string) => {
      const names = authors.split(/\s*[;；]\s*/).filter(Boolean);
      return `${tag} ${names.join(`\n${tag} `)}`;
    })
    .replace(/LA 中文;?/g, 'LA zh-CN')
    .trim();
}

@Injectable()
export class ResearchZoteroTranslatorService {
  private manifestCache: ZoteroTranslatorManifest[] | null = null;

  constructor(private readonly runtime: ResearchZoteroRuntimeService) {}

  async translateUrl(input: string): Promise<CitationTranslationResult | null> {
    const url = this.parseHttpUrl(input);
    const html = await this.fetchText(url.toString());
    return await this.translateHtml(url.toString(), html);
  }

  async translateHtml(input: string, html: string) {
    const url = this.parseHttpUrl(input);
    const runtimeResult = await this.runtime.translateHtml(
      url.toString(),
      html
    );
    if (runtimeResult) return runtimeResult;

    const matchedTranslators = await this.matchVendoredTranslators(
      url.toString()
    );
    const labels = new Set(matchedTranslators.map(item => item.label));
    const hostname = url.hostname.toLowerCase();

    if (
      labels.has('Google Scholar') ||
      /scholar[-.]google[-.]/i.test(hostname)
    ) {
      return this.translateGoogleScholar(url, html);
    }
    if (labels.has('CNKI') || hostname.endsWith('cnki.net')) {
      return await this.translateCnki(url, html);
    }
    if (
      labels.has('Baidu Scholar') ||
      hostname === 'xueshu.baidu.com' ||
      hostname.endsWith('.xueshu.baidu.com')
    ) {
      return await this.translateBaiduScholar(url, html);
    }

    return this.translateGenericMeta(
      url,
      html,
      matchedTranslators[0]?.label ?? 'Generic Metadata'
    );
  }

  async listVendoredTranslators() {
    if (this.manifestCache) return this.manifestCache;
    const files = (await readdir(ZOTERO_TRANSLATOR_ROOT)).filter(file =>
      file.endsWith('.js')
    );
    const manifests = await Promise.all(
      files.map(async file => {
        const source = await readFile(
          join(ZOTERO_TRANSLATOR_ROOT, file),
          'utf8'
        );
        const header = readTranslatorHeader(source);
        return header
          ? ({ ...JSON.parse(header), file } as ZoteroTranslatorManifest)
          : null;
      })
    );
    this.manifestCache = manifests
      .filter((item): item is NonNullable<(typeof manifests)[number]> => !!item)
      .sort((a, b) =>
        a.priority === b.priority
          ? a.label.localeCompare(b.label)
          : b.priority - a.priority
      );
    return this.manifestCache;
  }

  async listRuntimeTranslators() {
    return await this.runtime.listTranslators();
  }

  async matchVendoredTranslators(url: string) {
    const translators = await this.listVendoredTranslators();
    return translators.filter(translator => {
      if (!translator.target) return false;
      try {
        return new RegExp(translator.target, 'i').test(url);
      } catch {
        return false;
      }
    });
  }

  private parseHttpUrl(input: string) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new BadRequest('Translator URL is invalid.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequest('Only http and https URLs are supported.');
    }
    return url;
  }

  private async fetchText(url: string, init?: RequestInit) {
    try {
      const response = await safeFetch(
        url,
        {
          ...init,
          headers: {
            'User-Agent':
              'Mozilla/5.0 AFFiNE Research Translator (Zotero-compatible)',
            Accept:
              'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
            ...(init?.headers ?? {}),
          },
        },
        {
          timeoutMs: FETCH_TIMEOUT_MS,
          maxRedirects: 3,
          maxBytes: MAX_TRANSLATOR_BYTES,
        }
      );
      if (!response.ok || !response.body) {
        throw new BadRequest(`Translator fetch failed: ${response.status}`);
      }
      return new TextDecoder().decode(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof ResponseTooLargeError) {
        throw new BadRequest('Translator response is too large.');
      }
      throw error;
    }
  }

  private translateGoogleScholar(
    url: URL,
    html: string
  ): CitationTranslationResult | null {
    if (/unusual traffic|not a robot|captcha/i.test(html)) {
      throw new BadRequest('Google Scholar requires verification.');
    }

    const candidates: CitationTranslationCandidate[] = [];
    const rowPattern =
      /<div[^>]+class=["'][^"']*\bgs_r\b[^"']*["'][^>]*data-cid=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*\bgs_r\b|<\/body>)/gi;
    for (const match of html.matchAll(rowPattern)) {
      const [, id, row] = match;
      const titleMatch = row.match(
        /<h3[^>]*class=["'][^"']*\bgs_rt\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i
      );
      const linkMatch = titleMatch?.[1]?.match(
        /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      );
      const title = cleanTitle(linkMatch?.[2] ?? titleMatch?.[1]);
      if (!title) continue;
      const directUrl = absoluteUrl(linkMatch?.[1], url);
      const doi = row.match(DOI_PATTERN)?.[0];
      const arxivId = normalizeArxivId(row);
      candidates.push({
        id,
        title,
        url: directUrl,
        metadata: toMetadata(
          {
            title,
            doi,
            arxivId,
            url: directUrl,
            source: 'Google Scholar',
          },
          'google-scholar',
          doi || arxivId ? 0.76 : 0.62
        ),
      });
    }

    if (candidates.length) {
      return {
        kind: 'multiple',
        translator: 'Google Scholar',
        items: uniqCandidates(candidates).slice(0, 20),
      };
    }

    return this.translateGenericMeta(
      url,
      html,
      'Google Scholar',
      'google-scholar'
    );
  }

  private async translateCnki(
    url: URL,
    html: string
  ): Promise<CitationTranslationResult | null> {
    const id = this.cnkiIdFromUrl(url) ?? this.cnkiIdFromHtml(html);
    if (id) {
      const postData = `FileName=${id.dbname}!${id.filename}!1!0&DisplayMode=Refworks&OrderParam=0&OrderType=desc&SelectField=&PageIndex=1&PageSize=20&language=&uniplatform=NZKPT&random=${Math.random()}`;
      const refText = await this.fetchText(
        'https://kns.cnki.net/dm/api/ShowExport',
        {
          method: 'POST',
          body: postData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `https://kns.cnki.net/dm/manage/export.html?filename=${id.dbname}!${id.filename}!1!0&displaymode=NEW&uniplatform=NZKPT`,
          },
        }
      );
      const metadata = parseRefWorksCitation(
        cnkiExportHtmlToRefWorks(refText),
        'cnki',
        url.toString()
      );
      if (metadata) {
        return { kind: 'single', translator: 'CNKI', metadata };
      }
    }

    const candidates = this.cnkiSearchCandidates(url, html);
    if (candidates.length) {
      return {
        kind: 'multiple',
        translator: 'CNKI',
        items: candidates.slice(0, 20),
      };
    }
    return this.translateGenericMeta(url, html, 'CNKI', 'cnki');
  }

  private cnkiIdFromUrl(url: URL) {
    const dbname = url.searchParams.get('dbname');
    const filename = url.searchParams.get('filename');
    return dbname && filename ? { dbname, filename } : null;
  }

  private cnkiIdFromHtml(html: string) {
    const dbname =
      html.match(/id=["']paramdbname["'][^>]+value=["']([^"']+)["']/i)?.[1] ??
      html.match(/tablename=([^"'&]+)/i)?.[1];
    const filename =
      html.match(/id=["']paramfilename["'][^>]+value=["']([^"']+)["']/i)?.[1] ??
      html.match(/filename=([^"'&]+)/i)?.[1];
    if (!dbname || !filename) return null;
    return {
      dbname: decodeURIComponent(dbname),
      filename: decodeURIComponent(filename),
    };
  }

  private cnkiSearchCandidates(url: URL, html: string) {
    const candidates: CitationTranslationCandidate[] = [];
    const linkPattern =
      /<a[^>]+(?:class=["'][^"']*\bfz14\b[^"']*["'][^>]*)?href=["']([^"']*filename=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(linkPattern)) {
      const itemUrl = absoluteUrl(match[1], url);
      const title = cleanTitle(match[2]);
      if (!itemUrl || !title) continue;
      candidates.push({
        id: itemUrl,
        title,
        url: itemUrl,
        metadata: toMetadata(
          { title, url: itemUrl, source: 'CNKI' },
          'cnki',
          0.58
        ),
      });
    }
    return uniqCandidates(candidates);
  }

  private async translateBaiduScholar(
    url: URL,
    html: string
  ): Promise<CitationTranslationResult | null> {
    const paperId = url.searchParams.get('paperid');
    if (paperId) {
      const ris = await this.fetchText(
        `https://xueshu.baidu.com/u/citation?type=ris&paperid=${encodeURIComponent(
          paperId
        )}`
      );
      const metadata = parseRisCitation(ris, 'baidu-scholar', url.toString());
      if (metadata) {
        return {
          kind: 'single',
          translator: 'Baidu Scholar',
          metadata: {
            ...metadata,
            url: attr(html, 'url') ?? metadata.url ?? url.toString(),
            abstract:
              metadata.abstract ??
              clean(
                html.match(
                  /<div[^>]+class=["'][^"']*sc_abstract[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
                )?.[1]
              ),
          },
        };
      }
    }

    const candidates: CitationTranslationCandidate[] = [];
    const linkPattern =
      /<h3[^>]*>\s*<a[^>]+href=["']([^"']*show\?paperid=[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;
    for (const match of html.matchAll(linkPattern)) {
      const itemUrl = absoluteUrl(match[1], url);
      const title = cleanTitle(match[2]);
      if (!itemUrl || !title) continue;
      candidates.push({
        id: itemUrl,
        title,
        url: itemUrl,
        metadata: toMetadata(
          { title, url: itemUrl, source: 'Baidu Scholar' },
          'baidu-scholar',
          0.58
        ),
      });
    }
    if (candidates.length) {
      return {
        kind: 'multiple',
        translator: 'Baidu Scholar',
        items: uniqCandidates(candidates).slice(0, 20),
      };
    }
    return this.translateGenericMeta(
      url,
      html,
      'Baidu Scholar',
      'baidu-scholar'
    );
  }

  private translateGenericMeta(
    url: URL,
    html: string,
    translator = 'Generic Metadata',
    provider: CitationProviderName = 'generic-meta'
  ): CitationTranslationResult | null {
    const meta = this.extractMeta(html);
    const title =
      this.firstMeta(meta, 'citation_title', 'dc.title', 'og:title') ??
      cleanTitle(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    if (!title) return null;

    return {
      kind: 'single',
      translator,
      metadata: toMetadata(
        {
          title,
          authors: this.metaValues(meta, 'citation_author', 'author'),
          year: this.firstMeta(
            meta,
            'citation_publication_date',
            'citation_date',
            'dc.date'
          )?.match(/\d{4}/)?.[0],
          source:
            this.firstMeta(
              meta,
              'citation_journal_title',
              'citation_conference_title',
              'og:site_name'
            ) ?? url.hostname.replace(/^www\./, ''),
          doi:
            this.firstMeta(meta, 'citation_doi') ??
            html.match(DOI_PATTERN)?.[0],
          arxivId: normalizeArxivId(html),
          url:
            this.firstMeta(
              meta,
              'citation_abstract_html_url',
              'citation_pdf_url',
              'og:url'
            ) ?? url.toString(),
          abstract: this.firstMeta(meta, 'description', 'og:description'),
        },
        provider,
        meta.citation_title?.length ? 0.72 : 0.58
      ),
    };
  }

  private extractMeta(html: string) {
    const meta: Record<string, string[]> = {};
    const metaPattern = /<meta\b[^>]*>/gi;
    for (const match of html.matchAll(metaPattern)) {
      const tag = match[0];
      const key = clean(
        attr(tag, 'name') ?? attr(tag, 'property')
      ).toLowerCase();
      const content = clean(attr(tag, 'content'));
      if (!key || !content) continue;
      (meta[key] ??= []).push(content);
    }
    return meta;
  }

  private firstMeta(meta: Record<string, string[]>, ...keys: string[]) {
    for (const key of keys) {
      const value = meta[key.toLowerCase()]?.find(Boolean);
      if (value) return value;
    }
    return undefined;
  }

  private metaValues(meta: Record<string, string[]>, ...keys: string[]) {
    const values = keys.flatMap(key => meta[key.toLowerCase()] ?? []);
    return values.length ? values : undefined;
  }
}
