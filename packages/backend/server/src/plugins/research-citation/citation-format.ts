import type { CitationMetadata, CitationProviderName } from './types';

type FieldMap = Record<string, string[]>;

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN =
  /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;

export function cleanCitationText(value?: string | null) {
  return (
    value
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

export function normalizeCitationDoi(value?: string | null) {
  return cleanCitationText(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[).,;]+$/, '');
}

function withMetadata(
  input: Partial<CitationMetadata> & { title: string },
  provider: CitationProviderName,
  confidence: number
): CitationMetadata {
  return {
    ...input,
    title: cleanCitationText(input.title),
    authors: input.authors?.map(cleanCitationText).filter(Boolean).slice(0, 16),
    doi: normalizeCitationDoi(input.doi),
    provider,
    confidence,
    reliable: confidence >= 0.72,
  };
}

function pushField(fields: FieldMap, key: string, value: string) {
  const normalized = cleanCitationText(value);
  if (!normalized) return;
  (fields[key.toUpperCase()] ??= []).push(normalized);
}

function first(fields: FieldMap, ...keys: string[]) {
  for (const key of keys) {
    const value = fields[key.toUpperCase()]?.find(Boolean);
    if (value) return cleanCitationText(value);
  }
  return undefined;
}

function normalizeArxivId(value?: string | null) {
  return cleanCitationText(value)
    .match(ARXIV_PATTERN)?.[1]
    ?.replace(/v\d+$/i, '');
}

export function parseRisCitation(
  input: string,
  provider: CitationProviderName = 'local',
  fallbackUrl?: string
) {
  if (!/^TY\s+-\s+/im.test(input) && !/^TI\s+-\s+/im.test(input)) {
    return null;
  }
  const fields: FieldMap = {};
  let currentKey = '';
  for (const line of input.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9]{2})\s+-\s*(.*)$/);
    if (match) {
      currentKey = match[1];
      pushField(fields, currentKey, match[2]);
    } else if (currentKey && /^\s+/.test(line)) {
      const values = fields[currentKey] ?? [];
      values[values.length - 1] = cleanCitationText(
        `${values[values.length - 1] ?? ''} ${line}`
      );
    }
  }

  const title = first(fields, 'TI', 'T1', 'CT', 'BT');
  if (!title) return null;
  return withMetadata(
    {
      title,
      authors: [
        ...(fields.AU ?? []),
        ...(fields.A1 ?? []),
        ...(fields.A2 ?? []),
        ...(fields.A3 ?? []),
      ],
      year: first(fields, 'PY', 'Y1', 'DA')?.match(/\d{4}/)?.[0] ?? undefined,
      source: first(fields, 'JF', 'JO', 'JA', 'T2', 'PB'),
      doi: first(fields, 'DO') ?? input.match(DOI_PATTERN)?.[0],
      url: first(fields, 'UR', 'L1', 'L2') ?? fallbackUrl,
      abstract: first(fields, 'AB', 'N2'),
    },
    provider,
    0.84
  );
}

export function parseRisCitations(
  input: string,
  provider: CitationProviderName = 'local',
  fallbackUrl?: string
) {
  const records = input
    .split(/^ER\s+-\s*$/gim)
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => parseRisCitation(`${record}\nER  -`, provider, fallbackUrl))
    .filter((item): item is CitationMetadata => !!item);

  return records.length ? records : [];
}

export function parseRefWorksCitation(
  input: string,
  provider: CitationProviderName = 'local',
  fallbackUrl?: string
) {
  if (!/^(RT|T1|TI|A1)\s+/im.test(input)) return null;
  const fields: FieldMap = {};
  for (const line of input.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9])\s+(.+)$/);
    if (!match) continue;
    pushField(fields, match[1], match[2]);
  }

  const title = first(fields, 'T1', 'TI', 'BT');
  if (!title) return null;
  return withMetadata(
    {
      title,
      authors: [
        ...(fields.A1 ?? []),
        ...(fields.A2 ?? []),
        ...(fields.A3 ?? []),
        ...(fields.A4 ?? []),
        ...(fields.AU ?? []),
      ],
      year: first(fields, 'YR', 'Y1', 'PY')?.match(/\d{4}/)?.[0],
      source: first(fields, 'JF', 'JO', 'JA', 'T2', 'PB'),
      doi: first(fields, 'DO') ?? input.match(DOI_PATTERN)?.[0],
      url: first(fields, 'UR', 'U1', 'U2') ?? fallbackUrl,
      abstract: first(fields, 'AB', 'N2'),
    },
    provider,
    0.84
  );
}

export function parseRefWorksCitations(
  input: string,
  provider: CitationProviderName = 'local',
  fallbackUrl?: string
) {
  const starts = Array.from(input.matchAll(/^RT\s+/gim)).map(
    match => match.index ?? 0
  );
  if (starts.length <= 1) {
    const single = parseRefWorksCitation(input, provider, fallbackUrl);
    return single ? [single] : [];
  }

  return starts
    .map((start, index) => input.slice(start, starts[index + 1]).trim())
    .map(record => parseRefWorksCitation(record, provider, fallbackUrl))
    .filter((item): item is CitationMetadata => !!item);
}

function splitBibTeXEntries(input: string) {
  const entries: string[] = [];
  let index = 0;
  while (index < input.length) {
    const at = input.indexOf('@', index);
    if (at === -1) break;
    const opener = input.slice(at).search(/[({]/);
    if (opener === -1) break;
    const openIndex = at + opener;
    const openChar = input[openIndex];
    const closeChar = openChar === '(' ? ')' : '}';
    let depth = 1;
    let cursor = openIndex + 1;
    while (cursor < input.length && depth > 0) {
      const char = input[cursor];
      if (char === openChar) depth += 1;
      if (char === closeChar) depth -= 1;
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

function readBibTeXFields(input: string) {
  const fields: Record<string, string> = {};
  const openBrace = input.search(/[({]/);
  if (openBrace === -1) return fields;
  let index = openBrace + 1;

  // Skip the citation key before the first field assignment.
  let depth = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === '{' || char === '(') depth += 1;
    if (char === '}' || char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      index += 1;
      break;
    }
    index += 1;
  }

  while (index < input.length) {
    const keyMatch = input.slice(index).match(/^\s*,?\s*([A-Za-z][\w-]*)\s*=/);
    if (!keyMatch) break;
    const key = keyMatch[1].toLowerCase();
    index += keyMatch[0].length;
    while (/\s/.test(input[index] ?? '')) index += 1;

    const opener = input[index];
    let value = '';
    if (opener === '{') {
      index += 1;
      let depth = 1;
      const start = index;
      while (index < input.length && depth > 0) {
        if (input[index] === '{') depth += 1;
        if (input[index] === '}') depth -= 1;
        index += 1;
      }
      value = input.slice(start, index - 1);
    } else if (opener === '"') {
      index += 1;
      const start = index;
      while (index < input.length) {
        if (input[index] === '"' && input[index - 1] !== '\\') break;
        index += 1;
      }
      value = input.slice(start, index);
      index += 1;
    } else {
      const start = index;
      while (index < input.length && !/[,\n}]/.test(input[index])) index += 1;
      value = input.slice(start, index);
    }
    fields[key] = cleanCitationText(value.replace(/[{}]/g, ''));
  }
  return fields;
}

export function parseBibTeXCitation(
  input: string,
  provider: CitationProviderName = 'local'
) {
  if (!input.trim().startsWith('@')) return null;
  const fields = readBibTeXFields(input);
  const title = fields.title;
  if (!title) return null;
  return withMetadata(
    {
      title,
      authors: fields.author
        ?.split(/\s+and\s+/i)
        .map(cleanCitationText)
        .filter(Boolean),
      year: fields.year?.match(/\d{4}/)?.[0],
      source: fields.journal || fields.booktitle || fields.publisher,
      doi: fields.doi ?? input.match(DOI_PATTERN)?.[0],
      url: fields.url,
      abstract: fields.abstract,
    },
    provider,
    0.84
  );
}

export function parseBibTeXCitations(
  input: string,
  provider: CitationProviderName = 'local'
) {
  const entries = splitBibTeXEntries(input);
  if (!entries.length) {
    const single = parseBibTeXCitation(input, provider);
    return single ? [single] : [];
  }
  return entries
    .map(entry => parseBibTeXCitation(entry, provider))
    .filter((item): item is CitationMetadata => !!item);
}

function readCslDate(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as {
    ['date-parts']?: unknown;
    literal?: string;
    raw?: string;
  };
  const parts = Array.isArray(record['date-parts']) ? record['date-parts'] : [];
  const firstPart = parts[0];
  if (Array.isArray(firstPart) && firstPart[0]) {
    return String(firstPart[0]).match(/\d{4}/)?.[0];
  }
  return cleanCitationText(record.literal ?? record.raw).match(/\d{4}/)?.[0];
}

function readCslAuthors(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(author => {
      if (!author || typeof author !== 'object') return '';
      const record = author as {
        given?: string;
        family?: string;
        literal?: string;
        name?: string;
      };
      return cleanCitationText(
        record.literal ||
          record.name ||
          [record.given, record.family].filter(Boolean).join(' ')
      );
    })
    .filter(Boolean)
    .slice(0, 16);
}

function parseCslRecord(
  record: Record<string, unknown>,
  provider: CitationProviderName
) {
  const title = cleanCitationText(record.title as string | undefined);
  if (!title) return null;
  const doi = normalizeCitationDoi(record.DOI as string | undefined);
  const url = cleanCitationText(record.URL as string | undefined);
  return withMetadata(
    {
      title,
      authors: readCslAuthors(record.author),
      year:
        readCslDate(record.issued) ??
        readCslDate(record.published) ??
        readCslDate(record.accessed),
      source: cleanCitationText(
        (record['container-title'] as string | undefined) ??
          (record.publisher as string | undefined)
      ),
      doi,
      arxivId: normalizeArxivId(
        `${record.archive ?? ''} ${record['archive_location'] ?? ''} ${url}`
      ),
      url: url || (doi ? `https://doi.org/${doi}` : undefined),
      abstract: cleanCitationText(record.abstract as string | undefined),
    },
    provider,
    0.84
  );
}

export function parseCslJsonCitations(
  input: string,
  provider: CitationProviderName = 'local'
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return [];
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  return records
    .map(record =>
      record && typeof record === 'object'
        ? parseCslRecord(record as Record<string, unknown>, provider)
        : null
    )
    .filter((item): item is CitationMetadata => !!item);
}

export function parseCitationFormatEntries(
  input: string,
  provider: CitationProviderName = 'local',
  fallbackUrl?: string
) {
  const raw = input.trim();
  if (!raw) return [];
  if (raw.startsWith('@')) return parseBibTeXCitations(raw, provider);
  if (/^TY\s+-\s+/im.test(raw) || /^TI\s+-\s+/im.test(raw)) {
    return parseRisCitations(raw, provider, fallbackUrl);
  }
  if (/^(RT|T1|TI|A1)\s+/im.test(raw)) {
    return parseRefWorksCitations(raw, provider, fallbackUrl);
  }
  if (raw.startsWith('{') || raw.startsWith('[')) {
    return parseCslJsonCitations(raw, provider);
  }
  return [];
}
