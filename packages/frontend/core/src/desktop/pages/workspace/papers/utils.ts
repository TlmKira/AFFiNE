import type {
  ResearchFeedItem,
  ResearchPaperDuplicateResult,
  ResearchPaperMetadata,
} from './types';

export type CitationMetadata = {
  title: string;
  authors?: string[];
  year?: string;
  source?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  filename?: string;
  attachments?: Array<{
    title?: string;
    url?: string;
    mimeType?: string;
  }>;
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

export type PaperRecord = {
  docId: string;
  title: string;
  paper: ResearchPaperMetadata;
};

export type PaperTagGroup = {
  tag: string;
  records: PaperRecord[];
  latestReadTime: string;
};

export const UNCATEGORIZED_PAPER_TAG = '未分类';

export function parsePaperProperty(
  value: unknown
): ResearchPaperMetadata | null {
  if (!value) return null;
  if (typeof value === 'object') {
    return normalizePaper(value as ResearchPaperMetadata);
  }
  if (typeof value !== 'string') return null;
  try {
    return normalizePaper(JSON.parse(value) as ResearchPaperMetadata);
  } catch {
    return null;
  }
}

export function normalizeDoi(value?: string | null) {
  return (value ?? '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .replace(/[).,;]+$/, '')
    .toLowerCase();
}

export function normalizeArxivId(value?: string | null) {
  return (value ?? '')
    .replace(/^arxiv:/i, '')
    .replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, '')
    .replace(/\.pdf$/i, '')
    .replace(/v\d+$/i, '')
    .trim()
    .toLowerCase();
}

export function normalizeUrl(value?: string | null) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase();
  }
}

export function normalizePaperTags(tags: unknown): string[] {
  const rawTags =
    typeof tags === 'string'
      ? tags.split(/[,，、\n]/)
      : Array.isArray(tags)
        ? tags
        : [];

  return Array.from(
    new Set(
      rawTags
        .map(tag => String(tag).trim())
        .filter(Boolean)
        .map(tag => tag.replace(/\s+/g, ' '))
    )
  );
}

export function getPaperReadTime(paper: ResearchPaperMetadata) {
  return paper.lastReadAt || paper.addedAt || '';
}

export function sortPapersByReadTimeDesc(records: PaperRecord[]) {
  return records.toSorted((a, b) => {
    const timeDiff = getPaperReadTime(b.paper).localeCompare(
      getPaperReadTime(a.paper)
    );
    if (timeDiff) return timeDiff;
    return a.paper.title.localeCompare(b.paper.title);
  });
}

export function groupPapersByTags(records: PaperRecord[]): PaperTagGroup[] {
  const groups = new Map<string, PaperRecord[]>();

  for (const record of sortPapersByReadTimeDesc(records)) {
    const tags = normalizePaperTags(record.paper.tags);
    const groupTags = tags.length ? tags : [UNCATEGORIZED_PAPER_TAG];

    for (const tag of groupTags) {
      const groupRecords = groups.get(tag) ?? [];
      groupRecords.push(record);
      groups.set(tag, groupRecords);
    }
  }

  return Array.from(groups.entries())
    .map(([tag, groupRecords]) => ({
      tag,
      records: groupRecords,
      latestReadTime: groupRecords[0]
        ? getPaperReadTime(groupRecords[0].paper)
        : '',
    }))
    .toSorted((a, b) => {
      if (a.tag === UNCATEGORIZED_PAPER_TAG) return 1;
      if (b.tag === UNCATEGORIZED_PAPER_TAG) return -1;
      const timeDiff = b.latestReadTime.localeCompare(a.latestReadTime);
      if (timeDiff) return timeDiff;
      return a.tag.localeCompare(b.tag);
    });
}

export function findDuplicatePaper(
  papers: Array<{ docId: string; paper: ResearchPaperMetadata }>,
  candidate: Pick<ResearchPaperMetadata, 'doi' | 'arxivId' | 'url'>
): ResearchPaperDuplicateResult {
  const doi = normalizeDoi(candidate.doi);
  const arxivId = normalizeArxivId(candidate.arxivId);
  const url = normalizeUrl(candidate.url);

  for (const item of papers) {
    if (doi && normalizeDoi(item.paper.doi) === doi) {
      return { duplicated: true, docId: item.docId, reason: 'doi' };
    }
    if (arxivId && normalizeArxivId(item.paper.arxivId) === arxivId) {
      return { duplicated: true, docId: item.docId, reason: 'arxiv' };
    }
    if (url && normalizeUrl(item.paper.url) === url) {
      return { duplicated: true, docId: item.docId, reason: 'url' };
    }
  }

  return { duplicated: false };
}

export function findFuzzyDuplicate(
  papers: PaperRecord[],
  candidate: ResearchPaperMetadata
) {
  const title = normalizeTitle(candidate.title);
  const firstAuthor = normalizeAuthor(candidate.authors?.[0]);
  const year = candidate.year?.trim();
  if (!title || !firstAuthor || !year) return null;
  return (
    papers.find(item => {
      return (
        normalizeTitle(item.paper.title) === title &&
        normalizeAuthor(item.paper.authors?.[0]) === firstAuthor &&
        item.paper.year?.trim() === year
      );
    }) ?? null
  );
}

export function metadataToPaper(
  metadata: CitationMetadata,
  createdFrom: ResearchPaperMetadata['createdFrom'],
  extra: Partial<ResearchPaperMetadata> = {}
): ResearchPaperMetadata {
  return normalizePaper({
    title: metadata.title || '未命名论文',
    authors: metadata.authors ?? [],
    year: metadata.year,
    source: metadata.source,
    doi: metadata.doi,
    arxivId: metadata.arxivId,
    url: metadata.url,
    abstract: metadata.abstract,
    status: 'to-read',
    createdFrom,
    addedAt: new Date().toISOString(),
    ...extra,
  });
}

export function parseCitationInput(input: string): CitationMetadata {
  const raw = input.trim();
  const doi = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0];
  const arxivId = raw.match(
    /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i
  )?.[1];

  if (raw.startsWith('@')) {
    const title = readBibTeXField(raw, 'title') || '未命名论文';
    const bibDoi = readBibTeXField(raw, 'doi');
    return {
      title,
      authors: readBibTeXField(raw, 'author')
        .split(/\s+and\s+/i)
        .map(value => value.trim())
        .filter(Boolean),
      year: readBibTeXField(raw, 'year'),
      source:
        readBibTeXField(raw, 'journal') ||
        readBibTeXField(raw, 'booktitle') ||
        readBibTeXField(raw, 'publisher'),
      doi: bibDoi,
      url:
        readBibTeXField(raw, 'url') ||
        (bibDoi ? `https://doi.org/${bibDoi}` : undefined),
    };
  }

  if (/^TY\s+-\s+/im.test(raw) || /^TI\s+-\s+/im.test(raw)) {
    const readRis = (field: string) => {
      const matches = Array.from(
        raw.matchAll(new RegExp(`^${field}\\s+-\\s*(.+)$`, 'gim'))
      );
      return matches.map(match => match[1].trim()).filter(Boolean);
    };
    const title = readRis('TI')[0] || readRis('T1')[0] || '未命名论文';
    const risDoi = readRis('DO')[0];
    return {
      title,
      authors: [...readRis('AU'), ...readRis('A1')],
      year: (readRis('PY')[0] || readRis('Y1')[0])?.match(/\d{4}/)?.[0],
      source: readRis('JF')[0] || readRis('JO')[0] || readRis('T2')[0],
      doi: risDoi,
      url:
        readRis('UR')[0] || (risDoi ? `https://doi.org/${risDoi}` : undefined),
      abstract: readRis('AB')[0] || readRis('N2')[0],
    };
  }

  if (doi || /^https?:\/\/(?:dx\.)?doi\.org\//i.test(raw)) {
    const normalizedDoi = normalizeDoi(doi ?? raw);
    return {
      title: `DOI ${normalizedDoi}`,
      doi: normalizedDoi,
      url: `https://doi.org/${normalizedDoi}`,
    };
  }

  if (arxivId) {
    return {
      title: `arXiv ${arxivId}`,
      arxivId,
      source: 'arXiv',
      url: `https://arxiv.org/abs/${arxivId}`,
    };
  }

  try {
    const url = new URL(raw);
    return {
      title: url.hostname.replace(/^www\./, ''),
      source: url.hostname.replace(/^www\./, ''),
      url: url.toString(),
    };
  } catch {
    return {
      title: raw || '未命名论文',
      url: raw
        ? `https://scholar.google.com/scholar?q=${encodeURIComponent(raw)}`
        : undefined,
    };
  }
}

export function parseCitationInputs(input: string): CitationMetadata[] {
  const raw = input.trim();
  if (!raw) return [];

  if (raw.startsWith('@')) {
    const entries = splitBibTeXEntries(raw);
    return (entries.length ? entries : [raw]).map(parseCitationInput);
  }

  if (/^TY\s+-\s+/im.test(raw) || /^TI\s+-\s+/im.test(raw)) {
    const entries = raw
      .split(/^ER\s+-\s*$/gim)
      .map(entry => entry.trim())
      .filter(Boolean);
    return (entries.length ? entries.map(entry => `${entry}\nER  -`) : [raw])
      .map(parseCitationInput)
      .filter(item => item.title);
  }

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const items = records
        .map(record =>
          record && typeof record === 'object'
            ? cslJsonToCitation(record as Record<string, unknown>)
            : null
        )
        .filter((item): item is CitationMetadata => !!item);
      if (items.length) return items;
    } catch {
      // Fall through to the single-line fallback.
    }
  }

  return [parseCitationInput(raw)];
}

export function feedItemToPaper(item: ResearchFeedItem): ResearchPaperMetadata {
  return metadataToPaper(
    {
      title: item.title,
      authors: item.authors,
      year: item.publishedAt
        ? String(new Date(item.publishedAt).getFullYear())
        : undefined,
      source: '订阅源',
      doi: item.doi ?? undefined,
      arxivId: item.arxivId ?? undefined,
      url: item.url ?? undefined,
      abstract: item.abstract ?? undefined,
    },
    'feed'
  );
}

export function citationInputFromPaper(paper: ResearchPaperMetadata) {
  return (
    paper.doi ||
    (paper.arxivId ? `arXiv:${paper.arxivId}` : '') ||
    paper.url ||
    paper.title
  );
}

export function formatPaperCitation(
  paper: ResearchPaperMetadata,
  format: 'apa' | 'bibtex' | 'gbt' | 'markdown'
) {
  const authors = paper.authors?.join('; ') || '作者不详';
  const year = paper.year || '年份不详';
  const url = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : '');
  const key = (paper.doi || paper.arxivId || paper.title)
    .toLowerCase()
    .replace(/^10\.\d{4,9}\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  if (format === 'bibtex') {
    return [
      `@misc{${key || 'paper'},`,
      `  title = {${paper.title}},`,
      paper.authors?.length
        ? `  author = {${paper.authors.join(' and ')}},`
        : null,
      paper.year ? `  year = {${paper.year}},` : null,
      paper.source ? `  howpublished = {${paper.source}},` : null,
      paper.doi ? `  doi = {${paper.doi}},` : null,
      paper.arxivId ? `  eprint = {${paper.arxivId}},` : null,
      url ? `  url = {${url}},` : null,
      '}',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (format === 'apa') {
    return `${authors}. (${year}). ${paper.title}.${
      paper.source ? ` ${paper.source}.` : ''
    }${paper.doi ? ` https://doi.org/${paper.doi}` : url ? ` ${url}` : ''}`;
  }

  if (format === 'gbt') {
    return `${authors}. ${paper.title}[EB/OL]. ${year}.${
      paper.doi ? ` DOI:${paper.doi}.` : ''
    }${paper.arxivId ? ` arXiv:${paper.arxivId}.` : ''}${url ? ` ${url}` : ''}`;
  }

  return `[${paper.title}](${url || '#'})${paper.authors?.length ? ` - ${authors}` : ''}`;
}

export function duplicateReasonLabel(reason: 'doi' | 'arxiv' | 'url') {
  if (reason === 'doi') return 'DOI';
  if (reason === 'arxiv') return 'arXiv';
  return 'URL';
}

function normalizePaper(paper: ResearchPaperMetadata): ResearchPaperMetadata {
  return {
    ...paper,
    title: paper.title || '未命名论文',
    authors: Array.isArray(paper.authors) ? paper.authors : [],
    tags: normalizePaperTags(paper.tags),
    status: paper.status ?? 'to-read',
    createdFrom: paper.createdFrom ?? 'manual',
    addedAt: paper.addedAt ?? new Date().toISOString(),
  };
}

function normalizeTitle(title?: string) {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizeAuthor(author?: string) {
  return (author ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function readBibTeXField(raw: string, field: string) {
  const match = raw.match(new RegExp(`${field}\\s*=\\s*[{\"]([^}\"]+)`, 'i'));
  return match?.[1]?.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() ?? '';
}

function splitBibTeXEntries(input: string) {
  const entries: string[] = [];
  let index = 0;
  while (index < input.length) {
    const at = input.indexOf('@', index);
    if (at === -1) break;
    const openerOffset = input.slice(at).search(/[({]/);
    if (openerOffset === -1) break;
    const openIndex = at + openerOffset;
    const openChar = input[openIndex];
    const closeChar = openChar === '(' ? ')' : '}';
    let depth = 1;
    let cursor = openIndex + 1;
    while (cursor < input.length && depth > 0) {
      if (input[cursor] === openChar) depth += 1;
      if (input[cursor] === closeChar) depth -= 1;
      cursor += 1;
    }
    if (depth === 0) {
      entries.push(input.slice(at, cursor));
      index = cursor;
    } else {
      break;
    }
  }
  return entries;
}

function cslJsonToCitation(
  record: Record<string, unknown>
): CitationMetadata | null {
  const title = String(record.title ?? '').trim();
  if (!title) return null;
  const authors = Array.isArray(record.author)
    ? record.author
        .map(author => {
          if (!author || typeof author !== 'object') return '';
          const item = author as Record<string, unknown>;
          return String(
            item.literal ??
              item.name ??
              [item.given, item.family].filter(Boolean).join(' ')
          ).trim();
        })
        .filter(Boolean)
    : undefined;
  const issued = record.issued as
    | { ['date-parts']?: unknown; literal?: string; raw?: string }
    | undefined;
  const firstDatePart = Array.isArray(issued?.['date-parts'])
    ? issued?.['date-parts'][0]
    : undefined;
  const year = Array.isArray(firstDatePart)
    ? String(firstDatePart[0] ?? '').match(/\d{4}/)?.[0]
    : String(issued?.literal ?? issued?.raw ?? '').match(/\d{4}/)?.[0];
  const doi = normalizeDoi(String(record.DOI ?? record.doi ?? ''));
  const url = String(record.URL ?? record.url ?? '').trim();
  return {
    title,
    authors,
    year,
    source:
      String(record['container-title'] ?? record.publisher ?? '').trim() ||
      undefined,
    doi,
    url: url || (doi ? `https://doi.org/${doi}` : undefined),
    abstract: String(record.abstract ?? '').trim() || undefined,
  };
}
