import type {
  BookmarkBlockModel,
  BookmarkBlockProps,
} from '@blocksuite/affine-model';

type CitationInput = {
  author?: string;
  doi?: string;
  identifier?: string;
  source?: string;
  title: string;
  url: string;
  year?: string;
};

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN =
  /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?(\d{4}\.\d{4,5}(?:v\d+)?)/i;

function clean(value?: string | null) {
  return value?.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() ?? '';
}

function readBibTeXField(raw: string, field: string) {
  const match = raw.match(new RegExp(`${field}\\s*=\\s*[{\"]([^}\"]+)`, 'i'));
  return clean(match?.[1]);
}

function normalizeDoi(raw: string) {
  return raw.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').trim();
}

function parseBibTeX(raw: string): CitationInput | null {
  if (!raw.trim().startsWith('@')) {
    return null;
  }

  const title = readBibTeXField(raw, 'title') || '未命名论文';
  const author = readBibTeXField(raw, 'author');
  const year = readBibTeXField(raw, 'year');
  const source =
    readBibTeXField(raw, 'journal') ||
    readBibTeXField(raw, 'booktitle') ||
    readBibTeXField(raw, 'publisher');
  const doi = readBibTeXField(raw, 'doi');
  const url =
    readBibTeXField(raw, 'url') || (doi ? `https://doi.org/${doi}` : '');

  return {
    author,
    doi,
    identifier: doi ? `doi:${doi}` : undefined,
    source,
    title,
    url:
      url ||
      `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
    year,
  };
}

function parseResearchCitationInput(raw: string): CitationInput {
  const trimmed = raw.trim();
  const bibTeX = parseBibTeX(trimmed);
  if (bibTeX) {
    return bibTeX;
  }

  const doiMatch = trimmed.match(DOI_PATTERN);
  if (doiMatch || /^https?:\/\/(?:dx\.)?doi\.org\//i.test(trimmed)) {
    const doi = normalizeDoi(doiMatch?.[0] ?? trimmed);
    return {
      doi,
      identifier: `doi:${doi}`,
      title: `DOI ${doi}`,
      url: `https://doi.org/${doi}`,
    };
  }

  const arxivMatch = trimmed.match(ARXIV_PATTERN);
  if (arxivMatch) {
    const arxivId = arxivMatch[1];
    return {
      identifier: `arXiv:${arxivId}`,
      source: 'arXiv',
      title: `arXiv ${arxivId}`,
      url: `https://arxiv.org/abs/${arxivId}`,
    };
  }

  try {
    const url = new URL(trimmed);
    return {
      identifier: url.hostname,
      title: url.hostname.replace(/^www\./, ''),
      url: url.toString(),
    };
  } catch {
    return {
      title: trimmed || '未命名论文',
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(trimmed)}`,
    };
  }
}

function buildDescription(input: CitationInput) {
  return [
    input.author ? `作者：${input.author}` : null,
    input.year ? `年份：${input.year}` : null,
    input.source ? `来源：${input.source}` : null,
    input.identifier ? `标识：${input.identifier}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function createResearchCitationBookmarkProps(
  raw: string,
  footnoteIdentifier: string
): Partial<BookmarkBlockProps> {
  const input = parseResearchCitationInput(raw);
  return {
    description: buildDescription(input) || '论文引用',
    footnoteIdentifier,
    icon: null,
    image: null,
    style: 'citation',
    title: input.title,
    url: input.url,
  };
}

export function isResearchCitationModel(model: BookmarkBlockModel) {
  return model.props.style === 'citation' || !!model.props.footnoteIdentifier;
}

function citationParts(model: BookmarkBlockModel) {
  const title =
    clean(model.props.title) || clean(model.props.url) || 'Untitled';
  const url = clean(model.props.url);
  const description = clean(model.props.description);
  const year = description.match(/年份：([^·]+)/)?.[1]?.trim();
  const author = description.match(/作者：([^·]+)/)?.[1]?.trim();
  const key = `citation-${model.props.footnoteIdentifier || model.id}`;
  return { author, description, key, title, url, year };
}

export function formatResearchCitation(
  model: BookmarkBlockModel,
  format: 'apa' | 'bibtex' | 'gbt' | 'markdown'
) {
  const { author, key, title, url, year } = citationParts(model);

  if (format === 'bibtex') {
    return [
      `@misc{${key},`,
      `  title = {${title}},`,
      author ? `  author = {${author}},` : null,
      year ? `  year = {${year}},` : null,
      url ? `  url = {${url}},` : null,
      '}',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (format === 'apa') {
    return `${author || title}. (${year || 'n.d.'}). ${author ? title : ''}${url ? ` ${url}` : ''}`.trim();
  }

  if (format === 'gbt') {
    return `${author || '[作者不详]'}. ${title}[EB/OL]. ${year || '[年份不详]'}.${url ? ` ${url}` : ''}`;
  }

  return `[^${model.props.footnoteIdentifier || 1}]: ${title}${url ? ` ${url}` : ''}`;
}
