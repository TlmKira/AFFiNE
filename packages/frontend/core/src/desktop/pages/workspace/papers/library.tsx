import { Button, notify } from '@affine/component';
import { apis, appInfo } from '@affine/electron-api';
import { DocsService, type DocRecord } from '@affine/core/modules/doc';
import { AppSidebarService } from '@affine/core/modules/app-sidebar';
import {
  type PDF,
  type PDFPage,
  PDFService,
  type PDFRendererState,
  PDFStatus,
} from '@affine/core/modules/pdf';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { Text, type Store } from '@blocksuite/affine/store';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as styles from './index.css';
import {
  PAPER_STATUS_LABELS,
  PAPER_STATUS_ORDER,
  type ResearchPaperMetadata,
  type ResearchPaperStatus,
} from './types';
import {
  citationInputFromPaper,
  duplicateReasonLabel,
  findDuplicatePaper,
  findFuzzyDuplicate,
  formatPaperCitation,
  getPaperReadTime,
  groupPapersByTags,
  metadataToPaper,
  normalizeArxivId,
  normalizePaperTags,
  parseCitationInput,
  parseCitationInputs,
  parsePaperProperty,
  sortPapersByReadTimeDesc,
  type CitationMetadata,
  type CitationTranslationCandidate,
  type CitationTranslationResult,
  type ImportedPdfAttachment,
  type PaperRecord,
} from './utils';

const COLLAPSED_TAGS_STORAGE_PREFIX = 'affine:papers:collapsed-tags:';

type ImportQueueItem = {
  id: string;
  label: string;
  status: 'loading' | 'done' | 'failed' | 'multiple';
  message?: string;
  candidates?: CitationTranslationCandidate[];
};

function makeQueueId() {
  return `${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function readCollapsedTags(workspaceId: string) {
  if (typeof localStorage === 'undefined') return new Set<string>();
  try {
    const value = localStorage.getItem(
      `${COLLAPSED_TAGS_STORAGE_PREFIX}${workspaceId}`
    );
    return new Set<string>(value ? JSON.parse(value) : []);
  } catch {
    return new Set<string>();
  }
}

function formatReadTime(value?: string) {
  if (!value) return '尚未阅读';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
  });
}

function isCitationTextFile(file: File) {
  return (
    /\.(bib|ris|enw|nbib|txt|json|csl)$/i.test(file.name) ||
    /^text\//i.test(file.type) ||
    file.type === 'application/json'
  );
}

function addTemplateBlocks(
  store: Store,
  noteId: string,
  paper: ResearchPaperMetadata
) {
  let pdfAttachmentBlockId: string | undefined;
  const addParagraph = (text: string, type: 'text' | 'h2' = 'text') => {
    store.addBlock(
      'affine:paragraph',
      {
        type,
        text: new Text(text),
      },
      noteId
    );
  };

  addParagraph('摘要', 'h2');
  addParagraph(paper.abstract || '在这里整理论文摘要、核心问题和主要贡献。');
  addParagraph('PDF', 'h2');
  if (paper.pdfBlobId) {
    pdfAttachmentBlockId = store.addBlock(
      'affine:attachment',
      {
        name: paper.pdfName || `${paper.title}.pdf`,
        type: 'application/pdf',
        size: paper.pdfSize ?? 0,
        sourceId: paper.pdfBlobId,
        embed: true,
      },
      noteId
    );
    addParagraph(`已自动关联 PDF：${paper.pdfName || paper.pdfBlobId}`);
  } else {
    addParagraph('未找到可自动下载的 PDF，可以稍后把 PDF 拖入全部文档补充。');
  }
  addParagraph('精读笔记', 'h2');
  addParagraph('问题定义：\n方法亮点：\n关键假设：\n局限性：');
  addParagraph('方法', 'h2');
  addParagraph('记录模型结构、数据流、损失函数和实现细节。');
  addParagraph('实验', 'h2');
  addParagraph('记录数据集、指标、对比方法、消融实验和复现差异。');
  addParagraph('复现记录', 'h2');
  addParagraph('代码仓库：\n环境：\n进度：\n遇到的问题：');
  return pdfAttachmentBlockId;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function resolveCitation(input: string): Promise<CitationMetadata> {
  try {
    const response = await fetch('/api/research/citation/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) throw new Error(`resolve failed: ${response.status}`);
    return (await response.json()) as CitationMetadata;
  } catch {
    return parseCitationInput(input);
  }
}

async function translateCitationUrl(
  url: string
): Promise<CitationTranslationResult | CitationMetadata> {
  const response = await fetch('/api/research/citation/translate-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(`translate failed: ${response.status}`);
  return (await response.json()) as
    | CitationTranslationResult
    | CitationMetadata;
}

async function translateCitationHtml(
  url: string,
  html: string
): Promise<CitationTranslationResult | CitationMetadata> {
  const response = await fetch('/api/research/citation/translate-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, html }),
  });
  if (!response.ok) throw new Error(`translate failed: ${response.status}`);
  return (await response.json()) as
    | CitationTranslationResult
    | CitationMetadata;
}

async function parseCitationText(
  input: string
): Promise<CitationTranslationResult | CitationMetadata> {
  const response = await fetch('/api/research/citation/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!response.ok) throw new Error(`parse failed: ${response.status}`);
  return (await response.json()) as
    | CitationTranslationResult
    | CitationMetadata;
}

function usePaperRecords(docs: DocRecord[], version: number): PaperRecord[] {
  return useMemo(() => {
    const records = docs
      .map(doc => {
        const paper = parsePaperProperty(doc.getProperties().paper);
        if (!paper || doc.trash$.value) return null;
        return {
          docId: doc.id,
          title: doc.title$.value || paper.title,
          paper,
        };
      })
      .filter((item): item is PaperRecord => !!item);

    return sortPapersByReadTimeDesc(records);
  }, [docs, version]);
}

function bestPdfAttachment(metadata: CitationMetadata) {
  const attachments = metadata.attachments ?? [];
  const direct = attachments.find(
    attachment =>
      attachment.url &&
      (/application\/pdf/i.test(attachment.mimeType ?? '') ||
        /\.pdf(?:[?#].*)?$/i.test(attachment.url) ||
        /pdf/i.test(attachment.title ?? ''))
  );
  if (direct?.url) return direct;

  const arxivId =
    normalizeArxivId(metadata.arxivId) || normalizeArxivId(metadata.url);
  if (arxivId) {
    return {
      title: `${metadata.title || arxivId}.pdf`,
      url: `https://arxiv.org/pdf/${arxivId}.pdf`,
      mimeType: 'application/pdf',
    };
  }
  return null;
}

async function importPdfFromUrl(
  workspaceId: string,
  attachment: { url?: string; title?: string }
): Promise<ImportedPdfAttachment | null> {
  if (!attachment.url) return null;
  return await fetchJson<ImportedPdfAttachment>(
    '/api/research/papers/import-pdf-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        url: attachment.url,
        filename: attachment.title,
      }),
    }
  );
}

const PaperStatusSelect = ({
  status,
  onChange,
}: {
  status: ResearchPaperStatus;
  onChange: (status: ResearchPaperStatus) => void;
}) => {
  return (
    <select
      aria-label="阅读状态"
      className={styles.select}
      value={status}
      onChange={event => onChange(event.target.value as ResearchPaperStatus)}
    >
      {PAPER_STATUS_ORDER.map(item => (
        <option key={item} value={item}>
          {PAPER_STATUS_LABELS[item]}
        </option>
      ))}
    </select>
  );
};

const PaperCover = ({ paper }: { paper: ResearchPaperMetadata }) => {
  const pdfService = useService(PDFService);
  const [pdfEntity, setPdfEntity] = useState<{
    pdf: PDF;
    release: () => void;
  } | null>(null);
  const [pageEntity, setPageEntity] = useState<{
    page: PDFPage;
    release: () => void;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pdfState = useLiveData(
    useMemo(
      () =>
        pdfEntity
          ? pdfEntity.pdf.state$
          : new LiveData<PDFRendererState>({ status: PDFStatus.IDLE }),
      [pdfEntity]
    )
  );
  const bitmap = useLiveData(
    useMemo(
      () =>
        pageEntity
          ? pageEntity.page.bitmap$
          : new LiveData<ImageBitmap | null>(null),
      [pageEntity]
    )
  );

  useEffect(() => {
    if (!paper.pdfBlobId) return;
    const entity = pdfService.get(paper.pdfBlobId);
    setPdfEntity(entity);
    return () => {
      entity.release();
      setPdfEntity(null);
    };
  }, [paper.pdfBlobId, pdfService]);

  useEffect(() => {
    if (pdfState.status !== PDFStatus.Opened || !pdfEntity) return;
    const sourceSize = pdfState.meta.pageSizes[0];
    if (!sourceSize) return;
    const width = 220;
    const height = Math.round((sourceSize.height / sourceSize.width) * width);
    const entity = pdfEntity.pdf.page(0, `${width}:${height}:1`);
    entity.page.render({ width, height, scale: 1 });
    setPageEntity(entity);
    return () => {
      entity.page.render.unsubscribe();
      entity.release();
      setPageEntity(null);
    };
  }, [pdfEntity, pdfState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, canvas.width, canvas.height);
    context?.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  const showCanvas = paper.pdfBlobId && pdfState.status !== PDFStatus.Error;

  return (
    <div className={styles.coverFrame}>
      {showCanvas ? (
        <canvas
          ref={canvasRef}
          className={styles.coverCanvas}
          aria-label={`${paper.title} PDF 首页`}
        />
      ) : (
        <div className={styles.coverPlaceholder}>
          <div className={styles.coverSource}>{paper.source || '论文'}</div>
          <div className={styles.coverTitle}>{paper.title}</div>
          <div className={styles.coverMeta}>
            {paper.year || '年份未知'} · {PAPER_STATUS_LABELS[paper.status]}
          </div>
        </div>
      )}
    </div>
  );
};

export function usePaperLibraryCore() {
  const workspace = useService(WorkspaceService).workspace;
  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;
  const docs = useLiveData(docsService.list.docs$);
  const [version, setVersion] = useState(0);
  const papers = usePaperRecords(docs, version);

  const openDoc = useCallback(
    (docId: string) => {
      workbench.openDoc(docId, { at: 'active' });
    },
    [workbench]
  );

  const openPaper = useCallback(
    (record: PaperRecord) => {
      const doc = docsService.list.doc$(record.docId).value;
      if (doc) {
        doc.updateProperties({
          paper: {
            ...record.paper,
            lastReadAt: new Date().toISOString(),
          },
        });
        setVersion(value => value + 1);
      }
      openDoc(record.docId);
    },
    [docsService.list, openDoc]
  );

  const createPaperDoc = useCallback(
    (
      paper: ResearchPaperMetadata,
      options: {
        open?: boolean;
      } = {}
    ) => {
      const strongDuplicate = findDuplicatePaper(papers, paper);
      if (strongDuplicate.duplicated) {
        notify.error({
          title: '已存在该论文',
          message: `检测到相同 ${duplicateReasonLabel(
            strongDuplicate.reason
          )} 的论文。`,
          actions: [
            {
              key: 'open',
              label: '打开已有论文',
              onClick: () => openDoc(strongDuplicate.docId),
            },
          ],
        });
        return null;
      }

      let attachmentBlockId: string | undefined;
      const fuzzyDuplicate = findFuzzyDuplicate(papers, paper);
      const record = docsService.createDoc({
        title: paper.title,
        docProps: {
          onStoreLoad: (store, { noteId }) => {
            attachmentBlockId = addTemplateBlocks(store, noteId, paper);
          },
        },
      });
      record.setMeta({ title: paper.title });
      record.updateProperties({
        paper: attachmentBlockId
          ? { ...paper, pdfAttachmentBlockId: attachmentBlockId }
          : paper,
      });
      setVersion(value => value + 1);

      if (fuzzyDuplicate) {
        notify({
          title: '已添加论文',
          message: `存在标题、第一作者和年份相同的疑似重复：${fuzzyDuplicate.paper.title}`,
        });
      } else {
        notify.success({ title: '已创建论文文档' });
      }
      if (options.open ?? true) {
        openDoc(record.id);
      }
      return record.id;
    },
    [docsService, openDoc, papers]
  );

  const handleStatusChange = useCallback(
    (record: PaperRecord, status: ResearchPaperStatus) => {
      const doc = docsService.list.doc$(record.docId).value;
      if (!doc) return;
      doc.updateProperties({
        paper: {
          ...record.paper,
          status,
          lastReadAt: new Date().toISOString(),
        },
      });
      setVersion(value => value + 1);
    },
    [docsService.list]
  );

  const saveTags = useCallback(
    (record: PaperRecord, tagDraft: string) => {
      const doc = docsService.list.doc$(record.docId).value;
      if (!doc) return;
      doc.updateProperties({
        paper: {
          ...record.paper,
          tags: normalizePaperTags(tagDraft),
        },
      });
      setVersion(value => value + 1);
      notify.success({ title: '标签已更新' });
    },
    [docsService.list]
  );

  const copyCitation = useCallback((paper: ResearchPaperMetadata) => {
    const text = formatPaperCitation(paper, 'bibtex');
    navigator.clipboard
      ?.writeText(text)
      .then(() => notify.success({ title: 'BibTeX 已复制' }))
      .catch(() => notify.error({ title: '复制失败' }));
  }, []);

  const importPaperFromMetadata = useCallback(
    async (
      metadata: CitationMetadata,
      createdFrom: ResearchPaperMetadata['createdFrom']
    ) => {
      let pdfExtra: ImportedPdfAttachment | null = null;
      const attachment = bestPdfAttachment(metadata);
      if (attachment?.url) {
        try {
          pdfExtra = await importPdfFromUrl(workspace.id, attachment);
        } catch {
          notify({
            title: '未能自动下载 PDF',
            message: '论文已继续导入，可以稍后把 PDF 拖入全部文档补充。',
          });
        }
      }
      return createPaperDoc(
        metadataToPaper(metadata, createdFrom, pdfExtra ?? {}),
        { open: false }
      );
    },
    [createPaperDoc, workspace.id]
  );

  const importPaperFromPdf = useCallback(
    async (file: File) => {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error('请拖入 PDF 文件');
      }
      const pdfBlobId = await workspace.docCollection.blobSync.set(file);
      const formData = new FormData();
      formData.append('file', file);
      let metadata: CitationMetadata;
      try {
        metadata = await fetchJson<CitationMetadata>(
          `/api/research/papers/recognize-pdf?workspaceId=${encodeURIComponent(
            workspace.id
          )}`,
          {
            method: 'POST',
            body: formData,
          }
        );
      } catch {
        metadata = parseCitationInput(file.name.replace(/\.pdf$/i, ' '));
      }
      return createPaperDoc(
        metadataToPaper(metadata, 'pdf', {
          pdfBlobId,
          pdfName: file.name,
          pdfSize: file.size,
        }),
        { open: false }
      );
    },
    [createPaperDoc, workspace.docCollection.blobSync, workspace.id]
  );

  const importPaperFromText = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text) throw new Error('请输入论文线索');
      try {
        const url = new URL(text);
        const translated = await translateCitationUrl(url.toString());
        if ('kind' in translated) {
          if (translated.kind === 'single') {
            return {
              kind: 'single' as const,
              docId: await importPaperFromMetadata(
                translated.metadata,
                'manual'
              ),
              metadata: translated.metadata,
              translator: translated.translator,
            };
          }
          return translated;
        }
        return {
          kind: 'single' as const,
          docId: await importPaperFromMetadata(translated, 'manual'),
          metadata: translated,
        };
      } catch (error) {
        if (error instanceof TypeError) {
          let parsed: CitationTranslationResult | CitationMetadata;
          try {
            parsed = await parseCitationText(text);
          } catch {
            const localItems = parseCitationInputs(text);
            if (localItems.length > 1) {
              return {
                kind: 'multiple' as const,
                translator: 'Citation File',
                items: localItems.map((metadata, index) => ({
                  id:
                    metadata.doi ??
                    metadata.arxivId ??
                    metadata.url ??
                    `${index}`,
                  title: metadata.title,
                  url: metadata.url,
                  metadata,
                })),
              };
            }
            parsed = await resolveCitation(text);
          }
          if ('kind' in parsed) {
            if (parsed.kind === 'single') {
              return {
                kind: 'single' as const,
                docId: await importPaperFromMetadata(parsed.metadata, 'manual'),
                metadata: parsed.metadata,
                translator: parsed.translator,
              };
            }
            return parsed;
          }
          return {
            kind: 'single' as const,
            docId: await importPaperFromMetadata(parsed, 'manual'),
            metadata: parsed,
          };
        }
        throw error;
      }
    },
    [importPaperFromMetadata]
  );

  return {
    workspace,
    papers,
    openDoc,
    openPaper,
    createPaperDoc,
    handleStatusChange,
    saveTags,
    copyCitation,
    importPaperFromMetadata,
    importPaperFromPdf,
    importPaperFromText,
  };
}

export const PaperShelf = ({
  papers,
  workspaceId,
  onOpenPaper,
  onStatusChange,
  onSaveTags,
  onCopyCitation,
  emptyAction,
}: {
  papers: PaperRecord[];
  workspaceId: string;
  onOpenPaper: (record: PaperRecord) => void;
  onStatusChange: (record: PaperRecord, status: ResearchPaperStatus) => void;
  onSaveTags: (record: PaperRecord, tagDraft: string) => void;
  onCopyCitation: (paper: ResearchPaperMetadata) => void;
  emptyAction?: ReactNode;
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ResearchPaperStatus>(
    'all'
  );
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(
    () => new Set()
  );
  const [editingTagsDocId, setEditingTagsDocId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return papers.filter(item => {
      if (statusFilter !== 'all' && item.paper.status !== statusFilter) {
        return false;
      }
      if (!keyword) return true;
      return [
        item.paper.title,
        item.paper.authors?.join(' '),
        item.paper.year,
        item.paper.source,
        item.paper.doi,
        item.paper.arxivId,
        item.paper.tags?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [papers, query, statusFilter]);

  const paperGroups = useMemo(
    () => groupPapersByTags(filteredPapers),
    [filteredPapers]
  );

  useEffect(() => {
    setCollapsedTags(readCollapsedTags(workspaceId));
  }, [workspaceId]);

  const persistCollapsedTags = useCallback(
    (next: Set<string>) => {
      setCollapsedTags(next);
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(
          `${COLLAPSED_TAGS_STORAGE_PREFIX}${workspaceId}`,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // Local persistence is optional.
      }
    },
    [workspaceId]
  );

  const toggleTagGroup = useCallback(
    (tag: string) => {
      const next = new Set(collapsedTags);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      persistCollapsedTags(next);
    },
    [collapsedTags, persistCollapsedTags]
  );

  const startTagEdit = useCallback((record: PaperRecord) => {
    setEditingTagsDocId(record.docId);
    setTagDraft(normalizePaperTags(record.paper.tags).join(', '));
  }, []);

  return (
    <section className={styles.shelfPanel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>论文书架</div>
          <div className={styles.panelDescription}>
            按自定义标签分组，同一篇论文可以出现在多个标签下；组内按最近阅读时间排序。
          </div>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <input
              className={styles.search}
              value={query}
              placeholder="搜索标题、作者、标签、DOI、arXiv"
              onChange={event => setQuery(event.target.value)}
            />
            <select
              className={styles.select}
              value={statusFilter}
              onChange={event =>
                setStatusFilter(
                  event.target.value as 'all' | ResearchPaperStatus
                )
              }
            >
              <option value="all">全部状态</option>
              {PAPER_STATUS_ORDER.map(status => (
                <option key={status} value={status}>
                  {PAPER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {paperGroups.length ? (
        <div className={styles.shelfGroups}>
          {paperGroups.map(group => {
            const collapsed = collapsedTags.has(group.tag);
            return (
              <div className={styles.shelfGroup} key={group.tag}>
                <button
                  className={styles.shelfGroupHeader}
                  data-collapsed={collapsed}
                  onClick={() => toggleTagGroup(group.tag)}
                >
                  <span className={styles.shelfGroupChevron}>›</span>
                  <span className={styles.shelfGroupTitle}>{group.tag}</span>
                  <span className={styles.shelfGroupMeta}>
                    {group.records.length} 篇 · 最近阅读{' '}
                    {formatReadTime(group.latestReadTime)}
                  </span>
                </button>
                {!collapsed ? (
                  <div className={styles.paperGrid}>
                    {group.records.map(record => {
                      const fuzzy = findFuzzyDuplicate(
                        papers.filter(item => item.docId !== record.docId),
                        record.paper
                      );
                      const tags = normalizePaperTags(record.paper.tags);
                      const isEditingTags = editingTagsDocId === record.docId;

                      return (
                        <article
                          className={styles.paperCard}
                          key={`${group.tag}-${record.docId}`}
                        >
                          <button
                            className={styles.coverButton}
                            onClick={() => onOpenPaper(record)}
                          >
                            <PaperCover paper={record.paper} />
                          </button>
                          <button
                            className={styles.cardTitle}
                            onClick={() => onOpenPaper(record)}
                          >
                            {record.paper.title}
                          </button>
                          <div className={styles.cardMeta}>
                            {record.paper.authors?.join('; ') || '作者不详'}
                          </div>
                          <div className={styles.cardMeta}>
                            {record.paper.year || '年份未知'}
                            {record.paper.source
                              ? ` · ${record.paper.source}`
                              : ''}
                          </div>
                          <div className={styles.cardBadges}>
                            <span className={styles.badge}>
                              最近阅读{' '}
                              {formatReadTime(getPaperReadTime(record.paper))}
                            </span>
                            {record.paper.pdfBlobId ? (
                              <span className={styles.badge}>PDF</span>
                            ) : null}
                            {record.paper.arxivId ? (
                              <span className={styles.badge}>arXiv</span>
                            ) : null}
                            {fuzzy ? (
                              <span className={styles.warningBadge}>
                                疑似重复
                              </span>
                            ) : null}
                          </div>
                          <PaperStatusSelect
                            status={record.paper.status}
                            onChange={status => onStatusChange(record, status)}
                          />
                          {isEditingTags ? (
                            <div className={styles.tagEditor}>
                              <input
                                className={styles.input}
                                value={tagDraft}
                                placeholder="例如：机器人视觉, SLAM"
                                onChange={event =>
                                  setTagDraft(event.target.value)
                                }
                              />
                              <div className={styles.cardActions}>
                                <button
                                  className={styles.linkButton}
                                  onClick={() => {
                                    onSaveTags(record, tagDraft);
                                    setEditingTagsDocId(null);
                                    setTagDraft('');
                                  }}
                                >
                                  保存标签
                                </button>
                                <button
                                  className={styles.linkButton}
                                  onClick={() => {
                                    setEditingTagsDocId(null);
                                    setTagDraft('');
                                  }}
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.cardBadges}>
                              {(tags.length ? tags : ['未分类']).map(tag => (
                                <span className={styles.tagBadge} key={tag}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className={styles.cardActions}>
                            <button
                              className={styles.linkButton}
                              onClick={() => startTagEdit(record)}
                            >
                              编辑标签
                            </button>
                            <button
                              className={styles.linkButton}
                              onClick={() => {
                                navigator.clipboard
                                  ?.writeText(
                                    citationInputFromPaper(record.paper)
                                  )
                                  .then(() =>
                                    notify.success({
                                      title: '引用线索已复制',
                                    })
                                  );
                              }}
                            >
                              复制引用线索
                            </button>
                            <button
                              className={styles.linkButton}
                              onClick={() => onCopyCitation(record.paper)}
                            >
                              BibTeX
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div>还没有符合条件的论文。</div>
          {emptyAction ? (
            <div className={styles.emptyAction}>{emptyAction}</div>
          ) : null}
        </div>
      )}
    </section>
  );
};

type ResearchBrowserPanelProps = {
  open: boolean;
  onClose: () => void;
  onImportMetadata: (metadata: CitationMetadata) => Promise<string | null>;
};

type ElectronResearchBrowserApi = {
  create: () => Promise<{ id: string } | null>;
  navigate: (id: string, url: string) => Promise<{ url: string } | null>;
  goBack: (id: string) => Promise<void>;
  goForward: (id: string) => Promise<void>;
  reload: (id: string) => Promise<void>;
  stop: (id: string) => Promise<void>;
  capture: (
    id: string
  ) => Promise<{ url: string; title: string; html: string } | null>;
  setBounds: (
    id: string,
    bounds: { x: number; y: number; width: number; height: number }
  ) => Promise<void>;
  destroy: (id: string) => Promise<void>;
};

type ResearchBrowserIdentifyStatus =
  | 'idle'
  | 'capturing'
  | 'translating'
  | 'matched'
  | 'no-match'
  | 'backend-error'
  | 'fallback-ready';

type ResearchBrowserPage = {
  title: string;
  url: string;
  capturedUrl?: string | null;
};

const getElectronResearchBrowserApi = () => {
  if (!appInfo?.electron) return null;
  const researchBrowser = apis?.researchBrowser as
    | ElectronResearchBrowserApi
    | undefined;
  return researchBrowser?.create ? researchBrowser : null;
};

const hasTranslationResult = (
  result: CitationTranslationResult | CitationMetadata | null
) => {
  if (!result) return false;
  if ('kind' in result) {
    return result.kind === 'multiple'
      ? result.items.length > 0
      : !!result.metadata.title;
  }
  return !!result.title;
};

const statusTextByIdentifyStatus: Record<
  ResearchBrowserIdentifyStatus,
  string
> = {
  idle: '等待网页识别',
  capturing: '正在读取当前网页 HTML...',
  translating: '正在用 Zotero 识别当前网页...',
  matched: '已识别到可保存的论文条目',
  'no-match': 'Zotero 暂未识别到论文条目',
  'backend-error': '识别服务不可用，请确认 AFFiNE 后端已启动。',
  'fallback-ready': '已保留当前网页作为可导入线索',
};

const makeFallbackMetadata = (
  page: ResearchBrowserPage,
  source: string
): CitationMetadata | null => {
  const url = page.capturedUrl || page.url;
  if (!url) return null;
  const arxivId = normalizeArxivId(url);
  const title =
    page.title && page.title !== '尚未加载网页' && page.title !== url
      ? page.title
      : arxivId
        ? `arXiv ${arxivId}`
        : url;
  return {
    title,
    url,
    source: arxivId ? 'arXiv' : source,
    arxivId: arxivId || undefined,
  };
};

const ResearchBrowserResults = ({
  identifyStatus,
  error,
  result,
  page,
  onImportMetadata,
}: {
  identifyStatus: ResearchBrowserIdentifyStatus;
  error: string | null;
  result: CitationTranslationResult | CitationMetadata | null;
  page: ResearchBrowserPage;
  onImportMetadata: (metadata: CitationMetadata) => Promise<string | null>;
}) => {
  const importSingle = useCallback(
    async (metadata: CitationMetadata) => {
      const docId = await onImportMetadata(metadata);
      if (docId) {
        notify.success({ title: '已导入论文' });
      }
    },
    [onImportMetadata]
  );

  const importAll = useCallback(
    async (items: CitationTranslationCandidate[]) => {
      let count = 0;
      for (const item of items) {
        const metadata = item.metadata ?? {
          title: item.title,
          url: item.url,
          source: 'Zotero Translator',
        };
        if (await onImportMetadata(metadata)) count += 1;
      }
      notify.success({ title: `已导入 ${count} 篇论文` });
    },
    [onImportMetadata]
  );

  const singleMetadata =
    result && !('kind' in result)
      ? result
      : result?.kind === 'single'
        ? result.metadata
        : null;
  const candidates =
    result && 'kind' in result && result.kind === 'multiple'
      ? result.items
      : [];
  const translator =
    result && 'kind' in result ? result.translator : singleMetadata?.source;
  const fallbackMetadata = makeFallbackMetadata(page, '网页线索');
  const arxivFallbackMetadata = fallbackMetadata?.arxivId
    ? makeFallbackMetadata(page, 'arXiv')
    : null;
  const showFallbackActions =
    identifyStatus === 'no-match' ||
    identifyStatus === 'backend-error' ||
    identifyStatus === 'fallback-ready';

  const renderMetadataMeta = (metadata: CitationMetadata) => {
    const parts = [
      metadata.authors?.join('; '),
      metadata.year,
      metadata.source,
      metadata.doi ? `DOI ${metadata.doi}` : null,
      metadata.arxivId ? `arXiv ${metadata.arxivId}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : '作者不详';
  };

  const getAttachmentInfo = (metadata?: CitationMetadata) => {
    const attachments = metadata?.attachments ?? [];
    const pdfCount = attachments.filter(
      attachment =>
        attachment.mimeType === 'application/pdf' ||
        attachment.url?.toLowerCase().includes('.pdf') ||
        /pdf/i.test(attachment.title ?? '')
    ).length;

    if (pdfCount) {
      return {
        label: `PDF ${pdfCount}`,
        detail: `Zotero 已发现 ${pdfCount} 个 PDF 附件，导入时会尝试自动绑定。`,
        status: 'ready',
      } as const;
    }
    if (attachments.length) {
      return {
        label: `附件 ${attachments.length}`,
        detail: `已发现 ${attachments.length} 个网页附件。`,
        status: 'neutral',
      } as const;
    }
    return {
      label: '无 PDF',
      detail: '未发现可自动绑定的 PDF，导入后仍可手动拖入 PDF。',
      status: 'empty',
    } as const;
  };

  const renderCandidateCard = (
    metadata: CitationMetadata,
    options: {
      title?: string;
      url?: string;
      index?: number;
    } = {}
  ) => {
    const attachmentInfo = getAttachmentInfo(metadata);
    return (
      <div className={styles.detectedPaperCard}>
        <div className={styles.detectedPaperHeader}>
          <span className={styles.detectedPaperType}>
            {options.index ? `条目 ${options.index}` : '当前网页'}
          </span>
          <span
            className={styles.detectedPaperAttachment}
            data-status={attachmentInfo.status}
          >
            {attachmentInfo.label}
          </span>
        </div>
        <div className={styles.detectedPaperTitle}>
          {metadata.title || options.title || '未命名论文'}
        </div>
        <div className={styles.detectedPaperMeta}>
          {renderMetadataMeta(metadata)}
        </div>
        {metadata.abstract ? (
          <div className={styles.detectedPaperAbstract}>
            {metadata.abstract}
          </div>
        ) : null}
        <div className={styles.detectedPaperFooter}>
          <span className={styles.detectedPaperHint}>
            {attachmentInfo.detail}
          </span>
          <Button onClick={() => importSingle(metadata)}>保存为论文文档</Button>
        </div>
      </div>
    );
  };

  return (
    <section className={styles.browserDetectedPanel}>
      <div className={styles.browserDetectedHeader}>
        <div>
          <div className={styles.panelTitle}>当前网页论文</div>
          <div className={styles.panelDescription}>
            使用 Zotero translator 检测当前页面，可保存单篇或多篇论文。
          </div>
        </div>
        {translator ? (
          <span className={styles.detectedTranslator}>{translator}</span>
        ) : null}
      </div>
      <div className={styles.browserPageSummary}>
        <div className={styles.detectedPaperTitle}>
          {page.title || '尚未加载网页'}
        </div>
        <div className={styles.detectedPaperMeta}>
          {page.capturedUrl || page.url || '等待打开论文网页'}
        </div>
      </div>
      <div
        className={styles.browserDetectedStatus}
        data-status={identifyStatus}
      >
        {candidates.length
          ? `识别到 ${candidates.length} 条论文线索`
          : singleMetadata
            ? '识别到 1 篇论文'
            : statusTextByIdentifyStatus[identifyStatus]}
      </div>
      {page.capturedUrl ? (
        <div className={styles.browserCaptureStep}>
          已读取当前网页 HTML，来源：{page.capturedUrl}
        </div>
      ) : null}
      {error ? (
        <div className={styles.browserErrorBox}>
          <div className={styles.importQueueLabel}>
            {identifyStatus === 'backend-error'
              ? '识别服务未连接或出错'
              : '识别失败'}
          </div>
          <div className={styles.importQueueMessage}>{error}</div>
        </div>
      ) : null}
      {singleMetadata ? renderCandidateCard(singleMetadata) : null}
      {candidates.length ? (
        <div className={styles.detectedPaperList}>
          <div className={styles.detectedPaperBulk}>
            <Button variant="primary" onClick={() => importAll(candidates)}>
              全部保存 {candidates.length} 篇
            </Button>
          </div>
          {candidates.map((candidate, index) => (
            <div key={candidate.id}>
              {renderCandidateCard(
                candidate.metadata ?? {
                  title: candidate.title,
                  url: candidate.url,
                  source: 'Zotero Translator',
                },
                {
                  title: candidate.title,
                  url: candidate.url,
                  index: index + 1,
                }
              )}
            </div>
          ))}
        </div>
      ) : null}
      {identifyStatus === 'no-match' ? (
        <div className={styles.detectedEmpty}>
          Zotero 暂未识别到论文条目，可以用当前 URL 创建论文线索。
        </div>
      ) : null}
      {showFallbackActions && fallbackMetadata ? (
        <div className={styles.browserFallbackActions}>
          {arxivFallbackMetadata ? (
            <Button onClick={() => importSingle(arxivFallbackMetadata)}>
              按 arXiv ID 导入
            </Button>
          ) : null}
          <Button onClick={() => importSingle(fallbackMetadata)}>
            按当前 URL 导入
          </Button>
          <Button
            onClick={() =>
              importSingle({
                ...fallbackMetadata,
                source: '网页标题',
              })
            }
          >
            用网页标题创建论文线索
          </Button>
        </div>
      ) : null}
      {identifyStatus === 'idle' && !singleMetadata && !candidates.length ? (
        <div className={styles.detectedEmpty}>
          打开 arXiv、Google Scholar、CNKI、出版社页面或论文官网后，右侧会像
          Zotero Connector 一样显示可保存的论文条目。
        </div>
      ) : null}
    </section>
  );
};

const WebResearchBrowserPanel = ({
  open,
  onClose,
  onImportMetadata,
}: ResearchBrowserPanelProps) => {
  const [url, setUrl] = useState('https://arxiv.org/abs/1706.03762');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [identifyStatus, setIdentifyStatus] =
    useState<ResearchBrowserIdentifyStatus>('idle');
  const [result, setResult] = useState<
    CitationTranslationResult | CitationMetadata | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const runUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setIdentifyStatus('translating');
    try {
      const translated = await translateCitationUrl(url);
      setResult(translated);
      setIdentifyStatus(
        hasTranslationResult(translated) ? 'matched' : 'no-match'
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setIdentifyStatus('backend-error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const runHtml = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setIdentifyStatus('translating');
    try {
      const translated = await translateCitationHtml(url, html);
      setResult(translated);
      setIdentifyStatus(
        hasTranslationResult(translated) ? 'matched' : 'no-match'
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setIdentifyStatus('backend-error');
    } finally {
      setLoading(false);
    }
  }, [html, url]);

  if (!open) return null;

  return (
    <div className={styles.browserBackdrop}>
      <section className={styles.browserPanel} data-testid="research-browser">
        <div className={styles.browserHeader}>
          <div>
            <div className={styles.panelTitle}>研究浏览器</div>
            <div className={styles.panelDescription}>
              网页端使用降级模式：输入 URL 或粘贴网页 HTML，用 Zotero translator
              抓取论文线索。桌面端支持完整内置浏览器。
            </div>
          </div>
          <Button onClick={onClose}>关闭</Button>
        </div>
        <div className={styles.browserBody}>
          <div className={styles.browserControls}>
            <input
              className={styles.input}
              value={url}
              placeholder="论文网页 URL"
              onChange={event => setUrl(event.target.value)}
            />
            <Button loading={loading} variant="primary" onClick={runUrl}>
              识别 URL
            </Button>
          </div>
          <div className={styles.browserGrid}>
            <div className={styles.browserPreview}>
              <iframe
                className={styles.browserPreviewFrame}
                title="论文网页预览"
                src={url}
                sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
              />
            </div>
            <div className={styles.browserResult}>
              <textarea
                className={styles.textarea}
                value={html}
                placeholder="也可以粘贴本地网页 HTML，或把 .html 文件拖到这里"
                onChange={event => setHtml(event.target.value)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    file.text().then(setHtml).catch(console.error);
                  }
                }}
              />
              <Button
                disabled={!html.trim()}
                loading={loading}
                onClick={runHtml}
              >
                识别 HTML
              </Button>
              <div className={styles.notice}>
                有些网站会阻止内嵌预览；这不影响通过服务端 URL 或本地 HTML
                识别。
              </div>
              <ResearchBrowserResults
                identifyStatus={loading ? 'translating' : identifyStatus}
                error={error}
                result={result}
                page={{
                  title: url,
                  url,
                  capturedUrl: html.trim() ? url : null,
                }}
                onImportMetadata={onImportMetadata}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ElectronResearchBrowserPanel = ({
  open,
  onClose,
  onImportMetadata,
}: ResearchBrowserPanelProps) => {
  const api = useMemo(() => getElectronResearchBrowserApi(), []);
  const [url, setUrl] = useState('https://arxiv.org/abs/1706.03762');
  const [browserId, setBrowserId] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identifyStatus, setIdentifyStatus] =
    useState<ResearchBrowserIdentifyStatus>('idle');
  const [pageTitle, setPageTitle] = useState('尚未加载网页');
  const [status, setStatus] = useState('准备打开论文网页');
  const [lastAutoCapturedUrl, setLastAutoCapturedUrl] = useState<string | null>(
    null
  );
  const [result, setResult] = useState<
    CitationTranslationResult | CitationMetadata | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const identifyingRef = useRef(false);
  const lastAutoCapturedUrlRef = useRef<string | null>(null);

  const updateBounds = useCallback(() => {
    if (!api || !browserId || !placeholderRef.current) return;
    const rect = placeholderRef.current.getBoundingClientRect();
    api
      .setBounds(browserId, {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      })
      .catch(console.error);
  }, [api, browserId]);

  const captureAndIdentify = useCallback(
    async (
      options: {
        fallbackToClue?: boolean;
        skipIfUrlUnchanged?: boolean;
      } = {}
    ) => {
      if (!api || !browserId) return;
      if (identifyingRef.current) return;
      identifyingRef.current = true;
      setIdentifying(true);
      setError(null);
      setResult(null);
      setIdentifyStatus('capturing');
      try {
        const captured = await api.capture(browserId);
        if (!captured?.html) {
          throw new Error('没有捕获到当前网页内容');
        }

        if (
          options.skipIfUrlUnchanged &&
          captured.url === lastAutoCapturedUrlRef.current
        ) {
          return;
        }

        setUrl(captured.url);
        setPageTitle(captured.title || captured.url);
        lastAutoCapturedUrlRef.current = captured.url;
        setLastAutoCapturedUrl(captured.url);
        setStatus('已读取当前网页 HTML，正在发送给识别服务。');
        setIdentifyStatus('translating');
        const translated = await translateCitationHtml(
          captured.url,
          captured.html
        );
        setResult(translated);
        if (hasTranslationResult(translated)) {
          setIdentifyStatus('matched');
          setStatus('识别完成，可以保存为论文文档');
        } else {
          setIdentifyStatus('no-match');
          setStatus('Zotero 暂未识别到论文条目');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        if (options.fallbackToClue) {
          setIdentifyStatus('fallback-ready');
          setStatus('识别失败，已保留当前网页作为手动导入线索');
        } else {
          setIdentifyStatus('backend-error');
          setStatus('识别服务不可用，请确认 AFFiNE 后端已启动。');
        }
      } finally {
        identifyingRef.current = false;
        setIdentifying(false);
      }
    },
    [api, browserId, pageTitle, url]
  );

  const navigate = useCallback(
    async (targetUrl = url) => {
      if (!api || !browserId) return;
      setLoadingPage(true);
      setError(null);
      setResult(null);
      setIdentifyStatus('idle');
      lastAutoCapturedUrlRef.current = null;
      setLastAutoCapturedUrl(null);
      try {
        const loaded = await api.navigate(browserId, targetUrl);
        if (loaded?.url) {
          setUrl(loaded.url);
        }
        setStatus('网页已加载，正在自动识别当前页论文');
        window.setTimeout(() => {
          captureAndIdentify().catch(console.error);
        }, 800);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoadingPage(false);
        window.setTimeout(updateBounds, 0);
      }
    },
    [api, browserId, captureAndIdentify, updateBounds, url]
  );

  useEffect(() => {
    if (!open || !api) return;

    let disposed = false;
    let createdId: string | null = null;

    api
      .create()
      .then(created => {
        if (!created?.id || disposed) {
          if (created?.id) {
            api.destroy(created.id).catch(console.error);
          }
          return;
        }
        createdId = created.id;
        setBrowserId(created.id);
      })
      .catch(error => {
        setError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      disposed = true;
      if (createdId) {
        api.destroy(createdId).catch(console.error);
      }
    };
  }, [api, open]);

  useEffect(() => {
    if (!browserId) return;
    updateBounds();
    navigate(url).catch(console.error);
    // Only auto-load once after the native view is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserId]);

  useEffect(() => {
    if (!open || !browserId) return;

    const timer = window.setInterval(() => {
      captureAndIdentify({ skipIfUrlUnchanged: true }).catch(console.error);
    }, 3500);

    return () => {
      window.clearInterval(timer);
    };
  }, [browserId, captureAndIdentify, open]);

  useEffect(() => {
    if (!open || !browserId) return;
    const target = placeholderRef.current;
    const resizeObserver =
      target && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateBounds)
        : null;

    if (target) {
      resizeObserver?.observe(target);
    }

    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);
    window.setTimeout(updateBounds, 0);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, [browserId, open, updateBounds]);

  const callBrowser = useCallback(
    async (action: 'goBack' | 'goForward' | 'reload' | 'stop') => {
      if (!api || !browserId) return;
      setError(null);
      try {
        await api[action](browserId);
        window.setTimeout(updateBounds, 0);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [api, browserId, updateBounds]
  );

  if (!open || !api) return null;

  return (
    <div className={styles.browserBackdrop}>
      <section className={styles.browserPanel} data-testid="research-browser">
        <div className={styles.browserHeader}>
          <div>
            <div className={styles.panelTitle}>研究浏览器</div>
            <div className={styles.panelDescription}>
              桌面端内置浏览器：打开真实论文网页后，保存为论文文档时会捕获当前
              HTML，并交给 Zotero translator 识别。
            </div>
          </div>
          <Button onClick={onClose}>关闭</Button>
        </div>
        <div className={styles.browserBody}>
          <div className={styles.browserControls}>
            <input
              className={styles.input}
              value={url}
              placeholder="论文网页 URL"
              onChange={event => setUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  navigate().catch(console.error);
                }
              }}
            />
            <div className={styles.browserToolbar}>
              <Button onClick={() => callBrowser('goBack')}>后退</Button>
              <Button onClick={() => callBrowser('goForward')}>前进</Button>
              <Button onClick={() => callBrowser('reload')}>刷新</Button>
              <Button onClick={() => callBrowser('stop')}>停止</Button>
              <Button loading={loadingPage} onClick={() => navigate()}>
                打开
              </Button>
              <Button
                loading={identifying}
                variant="primary"
                onClick={() => captureAndIdentify({ fallbackToClue: true })}
              >
                重新识别
              </Button>
            </div>
          </div>
          <div className={styles.browserGrid}>
            <div className={styles.browserPreview}>
              <div ref={placeholderRef} className={styles.nativeBrowserView}>
                {!browserId ? '正在创建内置浏览器...' : null}
              </div>
            </div>
            <div className={styles.browserResult}>
              <div className={styles.browserPageInfo}>
                <div className={styles.importQueueLabel}>{pageTitle}</div>
                <div className={styles.importQueueMessage}>{status}</div>
              </div>
              <div className={styles.notice}>
                远程网页不会获得 AFFiNE 的桌面 API；导航仅允许 http/https。
              </div>
              <ResearchBrowserResults
                identifyStatus={identifyStatus}
                error={error}
                result={result}
                page={{
                  title: pageTitle,
                  url,
                  capturedUrl: lastAutoCapturedUrl,
                }}
                onImportMetadata={onImportMetadata}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ResearchBrowserPanel = (props: ResearchBrowserPanelProps) => {
  if (getElectronResearchBrowserApi()) {
    return <ElectronResearchBrowserPanel {...props} />;
  }

  return <WebResearchBrowserPanel {...props} />;
};

export const PaperImportButton = () => {
  const { importPaperFromMetadata } = usePaperLibraryCore();
  const appSidebar = useService(AppSidebarService).sidebar;
  const [browserOpen, setBrowserOpen] = useState(false);

  const openResearchBrowser = useCallback(() => {
    if (window.innerWidth <= 720) {
      appSidebar.setOpen(false);
    }
    setBrowserOpen(true);
  }, [appSidebar]);

  return (
    <>
      <Button data-testid="add-paper-button" onClick={openResearchBrowser}>
        添加论文
      </Button>
      <ResearchBrowserPanel
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onImportMetadata={metadata =>
          importPaperFromMetadata(metadata, 'manual')
        }
      />
    </>
  );
};

export const PaperLibraryView = () => {
  const {
    workspace,
    papers,
    openPaper,
    handleStatusChange,
    saveTags,
    copyCitation,
    importPaperFromPdf,
    importPaperFromText,
    importPaperFromMetadata,
  } = usePaperLibraryCore();
  const [dragging, setDragging] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([]);

  const updateQueueItem = useCallback(
    (id: string, patch: Partial<ImportQueueItem>) => {
      setImportQueue(items =>
        items.map(item => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const importText = useCallback(
    async (text: string, label = text) => {
      const id = makeQueueId();
      setImportQueue(items => [
        { id, label: label.slice(0, 120), status: 'loading' },
        ...items,
      ]);
      try {
        const result = await importPaperFromText(text);
        if (result.kind === 'multiple') {
          updateQueueItem(id, {
            status: 'multiple',
            message: `从 ${result.translator} 识别到 ${result.items.length} 条论文线索`,
            candidates: result.items,
          });
          return;
        }
        updateQueueItem(id, {
          status: result.docId ? 'done' : 'failed',
          message: result.docId ? '已创建论文文档' : '该论文可能已存在',
        });
      } catch (error) {
        updateQueueItem(id, {
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [importPaperFromText, updateQueueItem]
  );

  const importPdf = useCallback(
    async (file: File) => {
      const id = makeQueueId();
      setImportQueue(items => [
        { id, label: file.name, status: 'loading' },
        ...items,
      ]);
      try {
        const docId = await importPaperFromPdf(file);
        updateQueueItem(id, {
          status: docId ? 'done' : 'failed',
          message: docId ? 'PDF 已识别并添加' : '该论文可能已存在',
        });
      } catch (error) {
        updateQueueItem(id, {
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [importPaperFromPdf, updateQueueItem]
  );

  const handleImportCandidate = useCallback(
    async (candidate: CitationTranslationCandidate, queueId: string) => {
      const metadata: CitationMetadata = candidate.metadata ?? {
        title: candidate.title,
        url: candidate.url,
        source: 'Zotero Translator',
      };
      const docId = await importPaperFromMetadata(metadata, 'manual');
      updateQueueItem(queueId, {
        status: docId ? 'done' : 'failed',
        message: docId ? `已导入：${candidate.title}` : '该论文可能已存在',
      });
    },
    [importPaperFromMetadata, updateQueueItem]
  );

  const handleImportAllCandidates = useCallback(
    async (candidates: CitationTranslationCandidate[], queueId: string) => {
      let imported = 0;
      for (const candidate of candidates) {
        const metadata: CitationMetadata = candidate.metadata ?? {
          title: candidate.title,
          url: candidate.url,
          source: 'Zotero Translator',
        };
        if (await importPaperFromMetadata(metadata, 'manual')) {
          imported += 1;
        }
      }
      updateQueueItem(queueId, {
        status: imported > 0 ? 'done' : 'failed',
        message:
          imported > 0 ? `已导入 ${imported} 篇论文` : '这些论文可能都已存在',
      });
    },
    [importPaperFromMetadata, updateQueueItem]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length) {
        files.forEach(file => {
          if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
            importPdf(file).catch(console.error);
          } else if (isCitationTextFile(file)) {
            file
              .text()
              .then(text => importText(text, file.name))
              .catch(console.error);
          } else if (/\.html?$/i.test(file.name)) {
            file
              .text()
              .then(text => {
                setBrowserOpen(true);
                return importText(text, file.name);
              })
              .catch(console.error);
          } else {
            setImportQueue(items => [
              {
                id: makeQueueId(),
                label: file.name,
                status: 'failed',
                message:
                  '暂时只支持直接拖入 PDF、BibTeX、RIS、NBIB、CSL JSON、HTML 或文本文件。',
              },
              ...items,
            ]);
          }
        });
        return;
      }

      const text =
        event.dataTransfer.getData('text/uri-list') ||
        event.dataTransfer.getData('text/plain');
      text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .forEach(line => {
          importText(line).catch(console.error);
        });
    },
    [importPdf, importText]
  );

  const handleAddFromClipboard = useCallback(() => {
    const input = window.prompt('粘贴 DOI、arXiv、URL、BibTeX、RIS 或论文标题');
    if (input?.trim()) {
      importText(input).catch(console.error);
    }
  }, [importText]);

  return (
    <main
      className={styles.body}
      data-dragging={dragging}
      data-testid="papers-library-page"
      onDragEnter={event => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={event => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={event => {
        if (event.currentTarget === event.target) {
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      {dragging ? (
        <div className={styles.pageDropOverlay}>
          <div className={styles.pageDropCard}>
            <div className={styles.pageDropTitle}>拖入后创建论文文档</div>
            <div className={styles.pageDropHint}>
              支持 PDF、论文链接、DOI、arXiv、BibTeX、RIS、HTML 和普通文本线索
            </div>
          </div>
        </div>
      ) : null}
      <div className={styles.shelfContent}>
        <div className={styles.shelfQuickActions}>
          <Button onClick={handleAddFromClipboard}>添加论文</Button>
          <Button variant="primary" onClick={() => setBrowserOpen(true)}>
            研究浏览器
          </Button>
        </div>
        {importQueue.length ? (
          <section className={styles.importQueue}>
            <div className={styles.importQueueTitle}>导入队列</div>
            {importQueue.map(item => (
              <div className={styles.importQueueItem} key={item.id}>
                <div className={styles.importQueueMain}>
                  <div className={styles.importQueueLabel}>{item.label}</div>
                  <div className={styles.importQueueMessage}>
                    {item.status === 'loading'
                      ? '正在识别论文线索'
                      : item.message}
                  </div>
                  {item.status === 'multiple' && item.candidates?.length ? (
                    <div className={styles.importCandidates}>
                      <button
                        className={styles.importCandidatePrimary}
                        onClick={() =>
                          handleImportAllCandidates(
                            item.candidates ?? [],
                            item.id
                          )
                        }
                      >
                        全部导入 {item.candidates.length} 篇
                      </button>
                      {item.candidates.map(candidate => (
                        <button
                          className={styles.importCandidate}
                          key={candidate.id}
                          onClick={() =>
                            handleImportCandidate(candidate, item.id)
                          }
                        >
                          {candidate.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span
                  className={styles.importQueueStatus}
                  data-status={item.status}
                >
                  {item.status === 'loading'
                    ? '识别中'
                    : item.status === 'done'
                      ? '完成'
                      : item.status === 'multiple'
                        ? '可选择'
                        : '失败'}
                </span>
              </div>
            ))}
          </section>
        ) : null}
        <PaperShelf
          papers={papers}
          workspaceId={workspace.id}
          onOpenPaper={openPaper}
          onStatusChange={handleStatusChange}
          onSaveTags={saveTags}
          onCopyCitation={copyCitation}
          emptyAction={
            <Button variant="primary" onClick={() => setBrowserOpen(true)}>
              用研究浏览器添加第一篇论文
            </Button>
          }
        />
      </div>
      <ResearchBrowserPanel
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onImportMetadata={metadata =>
          importPaperFromMetadata(metadata, 'manual')
        }
      />
    </main>
  );
};
