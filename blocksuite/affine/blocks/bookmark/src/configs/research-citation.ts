import type {
  BookmarkBlockModel,
  BookmarkBlockProps,
} from '@blocksuite/affine-model';

export type ResearchCitationMetadata = {
  title: string;
  authors?: string[];
  year?: string;
  source?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  provider?: string;
  confidence?: number;
  reliable?: boolean;
};

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN =
  /(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;

function clean(value?: string | null) {
  return value?.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() ?? '';
}

function normalizeDoi(raw: string) {
  return raw
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .replace(/[).,;]+$/, '');
}

function readBibTeXField(raw: string, field: string) {
  const match = raw.match(new RegExp(`${field}\\s*=\\s*[{\"]([^}\"]+)`, 'i'));
  return clean(match?.[1]);
}

function parseLocalInput(raw: string): ResearchCitationMetadata {
  const trimmed = raw.trim();

  if (trimmed.startsWith('@')) {
    const title = readBibTeXField(trimmed, 'title') || '未命名论文';
    const doi = readBibTeXField(trimmed, 'doi');
    const url =
      readBibTeXField(trimmed, 'url') || (doi ? `https://doi.org/${doi}` : '');
    return {
      title,
      authors: readBibTeXField(trimmed, 'author')
        .split(/\s+and\s+/i)
        .map(clean)
        .filter(Boolean),
      year: readBibTeXField(trimmed, 'year'),
      source:
        readBibTeXField(trimmed, 'journal') ||
        readBibTeXField(trimmed, 'booktitle') ||
        readBibTeXField(trimmed, 'publisher'),
      doi,
      url:
        url ||
        `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
      provider: 'local',
      reliable: true,
    };
  }

  const doiMatch = trimmed.match(DOI_PATTERN);
  if (doiMatch || /^https?:\/\/(?:dx\.)?doi\.org\//i.test(trimmed)) {
    const doi = normalizeDoi(doiMatch?.[0] ?? trimmed);
    return {
      title: `DOI ${doi}`,
      doi,
      url: `https://doi.org/${doi}`,
      provider: 'local',
      reliable: false,
    };
  }

  const arxivMatch = trimmed.match(ARXIV_PATTERN);
  if (arxivMatch) {
    const arxivId = arxivMatch[1];
    return {
      title: `arXiv ${arxivId}`,
      arxivId,
      source: 'arXiv',
      url: `https://arxiv.org/abs/${arxivId}`,
      provider: 'local',
      reliable: false,
    };
  }

  try {
    const url = new URL(trimmed);
    return {
      title: url.hostname.replace(/^www\./, ''),
      source: url.hostname.replace(/^www\./, ''),
      url: url.toString(),
      provider: 'local',
      reliable: false,
    };
  } catch {
    return {
      title: trimmed || '未命名论文',
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(trimmed)}`,
      provider: 'local',
      reliable: false,
    };
  }
}

function buildDescription(input: ResearchCitationMetadata) {
  return [
    input.authors?.length ? `作者：${input.authors.join('; ')}` : null,
    input.year ? `年份：${input.year}` : null,
    input.source ? `来源：${input.source}` : null,
    input.doi ? `DOI：${input.doi}` : null,
    input.arxivId ? `arXiv：${input.arxivId}` : null,
    input.abstract ? `摘要：${input.abstract}` : null,
    input.provider && input.provider !== 'local'
      ? `补全：${input.provider}${input.reliable === false ? '（低置信度）' : ''}`
      : input.reliable === false
        ? '补全：未能可靠补全，可手动编辑。'
        : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function metadataToBookmarkProps(
  input: ResearchCitationMetadata,
  footnoteIdentifier: string
): Partial<BookmarkBlockProps> {
  return {
    description: buildDescription(input) || '论文引用',
    footnoteIdentifier,
    icon: null,
    image: null,
    style: 'citation',
    title: input.title || '未命名论文',
    url:
      input.url ||
      (input.doi
        ? `https://doi.org/${input.doi}`
        : `https://scholar.google.com/scholar?q=${encodeURIComponent(
            input.title
          )}`),
  };
}

export function createResearchCitationBookmarkProps(
  raw: string,
  footnoteIdentifier: string
): Partial<BookmarkBlockProps> {
  return metadataToBookmarkProps(parseLocalInput(raw), footnoteIdentifier);
}

export async function createResolvedResearchCitationBookmarkProps(
  raw: string,
  footnoteIdentifier: string
): Promise<{ props: Partial<BookmarkBlockProps>; resolved: boolean }> {
  try {
    const response = await fetch('/api/research/citation/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: raw }),
    });
    if (!response.ok) {
      throw new Error(`Citation resolve failed: ${response.status}`);
    }
    const metadata = (await response.json()) as ResearchCitationMetadata;
    return {
      props: metadataToBookmarkProps(metadata, footnoteIdentifier),
      resolved: metadata.provider !== 'local' && metadata.reliable !== false,
    };
  } catch {
    return {
      props: createResearchCitationBookmarkProps(raw, footnoteIdentifier),
      resolved: false,
    };
  }
}

export function isResearchCitationModel(model: BookmarkBlockModel) {
  return model.props.style === 'citation' || !!model.props.footnoteIdentifier;
}

function readDescriptionField(description: string, label: string) {
  return description
    .split('\n')
    .find(line => line.startsWith(`${label}：`))
    ?.slice(label.length + 1)
    .trim();
}

function citationParts(model: BookmarkBlockModel) {
  const title =
    clean(model.props.title) || clean(model.props.url) || 'Untitled';
  const url = clean(model.props.url);
  const description = clean(model.props.description);
  const author = readDescriptionField(description, '作者');
  const year = readDescriptionField(description, '年份');
  const doi = readDescriptionField(description, 'DOI');
  const source = readDescriptionField(description, '来源');
  const keySource = doi || title;
  const key = clean(keySource)
    .toLowerCase()
    .replace(/^10\.\d{4,9}\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return {
    author,
    description,
    doi,
    key: key || `citation-${model.props.footnoteIdentifier || model.id}`,
    source,
    title,
    url,
    year,
  };
}

export function formatResearchCitation(
  model: BookmarkBlockModel,
  format: 'apa' | 'bibtex' | 'gbt' | 'markdown'
) {
  const { author, doi, key, source, title, url, year } = citationParts(model);

  if (format === 'bibtex') {
    return [
      `@misc{${key},`,
      `  title = {${title}},`,
      author ? `  author = {${author.replace(/; /g, ' and ')}},` : null,
      year ? `  year = {${year}},` : null,
      source ? `  howpublished = {${source}},` : null,
      doi ? `  doi = {${doi}},` : null,
      url ? `  url = {${url}},` : null,
      '}',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (format === 'apa') {
    return `${author || title}. (${year || 'n.d.'}). ${author ? title : ''}${
      source ? ` ${source}.` : ''
    }${doi ? ` https://doi.org/${doi}` : url ? ` ${url}` : ''}`.trim();
  }

  if (format === 'gbt') {
    return `${author || '[作者不详]'}. ${title}[EB/OL]. ${
      year || '[年份不详]'
    }.${doi ? ` DOI:${doi}.` : ''}${url ? ` ${url}` : ''}`;
  }

  return `[^${model.props.footnoteIdentifier || 1}]: ${title}${
    doi ? ` https://doi.org/${doi}` : url ? ` ${url}` : ''
  }`;
}
