import { Button, notify } from '@affine/component';
import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { DocsService, type DocRecord } from '@affine/core/modules/doc';
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
  type ResearchFeedItem,
  type ResearchFeedSubscription,
  type ResearchPaperMetadata,
  type ResearchPaperStatus,
} from './types';
import {
  citationInputFromPaper,
  duplicateReasonLabel,
  feedItemToPaper,
  findDuplicatePaper,
  findFuzzyDuplicate,
  formatPaperCitation,
  getPaperReadTime,
  groupPapersByTags,
  metadataToPaper,
  normalizePaperTags,
  parseCitationInput,
  parseCitationInputs,
  parsePaperProperty,
  sortPapersByReadTimeDesc,
  type CitationMetadata,
  type CitationTranslationResult,
  type PaperRecord,
} from './utils';

const QUICK_FEEDS = [
  { title: 'arXiv cs.CV', url: 'https://export.arxiv.org/rss/cs.CV' },
  { title: 'arXiv cs.RO', url: 'https://export.arxiv.org/rss/cs.RO' },
  { title: 'arXiv cs.AI', url: 'https://export.arxiv.org/rss/cs.AI' },
];

type FetchState = 'idle' | 'loading';

const COLLAPSED_TAGS_STORAGE_PREFIX = 'affine:papers:collapsed-tags:';

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

function addTemplateBlocks(
  store: Store,
  noteId: string,
  paper: ResearchPaperMetadata
) {
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
  addParagraph(
    paper.pdfBlobId
      ? `已关联 PDF：${paper.pdfName || paper.pdfBlobId}`
      : '将 PDF 拖到论文库后会记录在论文属性中，也可以在这里补充附件。'
  );
  addParagraph('精读笔记', 'h2');
  addParagraph('问题定义：\n方法亮点：\n关键假设：\n局限性：');
  addParagraph('方法', 'h2');
  addParagraph('记录模型结构、数据流、损失函数和实现细节。');
  addParagraph('实验', 'h2');
  addParagraph('记录数据集、指标、对比方法、消融实验和复现差异。');
  addParagraph('复现记录', 'h2');
  addParagraph('代码仓库：\n环境：\n进度：\n遇到的问题：');
}

async function resolveCitation(input: string): Promise<CitationMetadata> {
  try {
    const response = await fetch('/api/research/citation/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) {
      throw new Error(`resolve failed: ${response.status}`);
    }
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
  if (!response.ok) {
    throw new Error(`translate failed: ${response.status}`);
  }
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
  if (!response.ok) {
    throw new Error(`parse failed: ${response.status}`);
  }
  return (await response.json()) as
    | CitationTranslationResult
    | CitationMetadata;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
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
    useMemo(() => {
      return pdfEntity
        ? pdfEntity.pdf.state$
        : new LiveData<PDFRendererState>({ status: PDFStatus.IDLE });
    }, [pdfEntity])
  );
  const bitmap = useLiveData(
    useMemo(() => {
      return pageEntity
        ? pageEntity.page.bitmap$
        : new LiveData<ImageBitmap | null>(null);
    }, [pageEntity])
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
    const height = Math.max(
      260,
      Math.round((sourceSize.height / sourceSize.width) * width)
    );
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const entity = pdfEntity.pdf.page(0, `${width}:${height}:${scale}`);
    setPageEntity(entity);
    entity.page.render({ width, height, scale });
    return () => {
      entity.page.render.unsubscribe();
      entity.release();
      setPageEntity(null);
    };
  }, [pdfEntity, pdfState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!bitmap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.clearRect(0, 0, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    canvas.dataset.ready = 'true';
  }, [bitmap]);

  const showCanvas = paper.pdfBlobId && pdfState.status !== PDFStatus.Error;

  return (
    <div className={styles.coverFrame}>
      {showCanvas ? (
        <canvas
          aria-label="PDF 第一页封面"
          className={styles.coverCanvas}
          ref={canvasRef}
        />
      ) : null}
      {!bitmap || !showCanvas ? (
        <div className={styles.coverPlaceholder}>
          <div className={styles.coverSource}>{paper.source || '论文'}</div>
          <div className={styles.coverTitle}>{paper.title}</div>
          <div className={styles.coverMeta}>
            {paper.year || '年份未知'} · {PAPER_STATUS_LABELS[paper.status]}
          </div>
        </div>
      ) : null}
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

      const fuzzyDuplicate = findFuzzyDuplicate(papers, paper);
      const record = docsService.createDoc({
        title: paper.title,
        docProps: {
          onStoreLoad: (store, { noteId }) => {
            addTemplateBlocks(store, noteId, paper);
          },
        },
      });
      record.setMeta({ title: paper.title });
      record.updateProperties({ paper });
      setVersion(value => value + 1);

      if (fuzzyDuplicate) {
        notify({
          title: '已添加论文',
          message: `存在标题、第一作者和年份相同的疑似重复：${fuzzyDuplicate.paper.title}`,
        });
      } else {
        notify.success({ title: '已添加到论文库' });
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
    (
      metadata: CitationMetadata,
      createdFrom: ResearchPaperMetadata['createdFrom']
    ) => {
      return createPaperDoc(metadataToPaper(metadata, createdFrom), {
        open: false,
      });
    },
    [createPaperDoc]
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
              docId: importPaperFromMetadata(translated.metadata, 'manual'),
              metadata: translated.metadata,
              translator: translated.translator,
            };
          }
          return translated;
        }
        return {
          kind: 'single' as const,
          docId: importPaperFromMetadata(translated, 'manual'),
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
                docId: importPaperFromMetadata(parsed.metadata, 'manual'),
                metadata: parsed.metadata,
                translator: parsed.translator,
              };
            }
            return parsed;
          }
          return {
            kind: 'single' as const,
            docId: importPaperFromMetadata(parsed, 'manual'),
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
                  <span className={styles.shelfGroupChevron}>⌄</span>
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

export const PaperLibrarySettings = () => {
  const { workspace, papers, createPaperDoc, openDoc } = usePaperLibraryCore();
  const [manualInput, setManualInput] = useState('');
  const [manualState, setManualState] = useState<FetchState>('idle');
  const [pdfState, setPdfState] = useState<FetchState>('idle');
  const [dragging, setDragging] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedState, setFeedState] = useState<FetchState>('idle');
  const [feeds, setFeeds] = useState<ResearchFeedSubscription[]>([]);
  const [feedItems, setFeedItems] = useState<ResearchFeedItem[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);

  const loadFeeds = useCallback(async () => {
    try {
      setFeedError(null);
      const [nextFeeds, nextItems] = await Promise.all([
        fetchJson<ResearchFeedSubscription[]>(
          `/api/research/feeds?workspaceId=${encodeURIComponent(workspace.id)}`
        ),
        fetchJson<ResearchFeedItem[]>(
          `/api/research/feed-items?workspaceId=${encodeURIComponent(
            workspace.id
          )}`
        ),
      ]);
      setFeeds(nextFeeds);
      setFeedItems(nextItems);
    } catch (error) {
      setFeedError(
        error instanceof Error
          ? error.message
          : '订阅源加载失败，本地预览可以先使用手动添加。'
      );
    }
  }, [workspace.id]);

  useEffect(() => {
    loadFeeds().catch(console.error);
  }, [loadFeeds]);

  const handleManualAdd = useCallback(async () => {
    const input = manualInput.trim();
    if (!input) {
      notify.error({ title: '请输入 DOI、arXiv、URL、BibTeX 或标题' });
      return;
    }
    setManualState('loading');
    try {
      const metadata = await resolveCitation(input);
      const docId = createPaperDoc(metadataToPaper(metadata, 'manual'));
      if (docId) {
        setManualInput('');
      }
    } catch (error) {
      notify.error({
        title: '添加论文失败',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setManualState('idle');
    }
  }, [createPaperDoc, manualInput]);

  const handlePdfFile = useCallback(
    async (file: File) => {
      if (file.type && file.type !== 'application/pdf') {
        notify.error({ title: '请拖入 PDF 文件' });
        return;
      }
      setPdfState('loading');
      try {
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
          notify({
            title: 'PDF 已保存，识别服务不可用',
            message: '已用文件名生成论文草稿，稍后可以手动补全元数据。',
          });
        }
        createPaperDoc(
          metadataToPaper(metadata, 'pdf', {
            pdfBlobId,
            pdfName: file.name,
          })
        );
      } catch (error) {
        notify.error({
          title: 'PDF 导入失败',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setPdfState('idle');
      }
    },
    [createPaperDoc, workspace.docCollection.blobSync, workspace.id]
  );

  const handleAddFeed = useCallback(
    async (url: string, title?: string) => {
      const nextUrl = url.trim();
      if (!nextUrl) {
        notify.error({ title: '请输入 RSS 或 Atom 订阅地址' });
        return;
      }
      setFeedState('loading');
      try {
        await fetchJson<ResearchFeedSubscription>('/api/research/feeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: workspace.id,
            url: nextUrl,
            title,
          }),
        });
        setFeedUrl('');
        notify.success({ title: '订阅源已添加' });
        await loadFeeds();
      } catch (error) {
        notify.error({
          title: '添加订阅源失败',
          message:
            error instanceof Error
              ? error.message
              : '请确认已连接 AFFiNE 服务端并具备工作区写权限。',
        });
      } finally {
        setFeedState('idle');
      }
    },
    [loadFeeds, workspace.id]
  );

  const handleRefreshFeed = useCallback(
    async (feedId: string) => {
      setFeedState('loading');
      try {
        await fetchJson(`/api/research/feeds/${feedId}/refresh`, {
          method: 'POST',
        });
        notify.success({ title: '订阅源已刷新' });
        await loadFeeds();
      } catch (error) {
        notify.error({
          title: '刷新订阅源失败',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setFeedState('idle');
      }
    },
    [loadFeeds]
  );

  const handleToggleFeed = useCallback(
    async (feed: ResearchFeedSubscription) => {
      try {
        await fetchJson(`/api/research/feeds/${feed.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !feed.enabled }),
        });
        await loadFeeds();
      } catch (error) {
        notify.error({
          title: '更新订阅源失败',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [loadFeeds]
  );

  const handleImportFeedItem = useCallback(
    (item: ResearchFeedItem) => {
      createPaperDoc(feedItemToPaper(item));
    },
    [createPaperDoc]
  );

  return (
    <>
      <SettingHeader
        title="论文库"
        subtitle="管理论文导入、PDF 识别和 arXiv / RSS 订阅。"
      />
      <SettingWrapper title="添加论文">
        <div className={styles.settingsStack}>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.label}>论文线索</span>
              <textarea
                className={styles.textarea}
                value={manualInput}
                placeholder="例如：arXiv:1706.03762、10.1145/...、BibTeX 或论文标题"
                onChange={event => setManualInput(event.target.value)}
              />
            </label>
            <Button
              className={styles.formActionButton}
              variant="primary"
              disabled={manualState === 'loading'}
              onClick={handleManualAdd}
            >
              {manualState === 'loading' ? '解析中' : '添加论文'}
            </Button>
          </div>
          <div
            className={styles.dropZone}
            data-dragging={dragging}
            onDragEnter={event => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) {
                handlePdfFile(file).catch(console.error);
              }
            }}
          >
            <div className={styles.dropTitle}>
              {pdfState === 'loading' ? '正在识别 PDF' : '拖拽 PDF 到这里'}
            </div>
            <div className={styles.dropHint}>
              PDF 会保存到当前工作区 Blob，并尝试识别 DOI、arXiv
              或标题；识别失败也会保留可编辑草稿。
            </div>
          </div>
        </div>
      </SettingWrapper>

      <SettingWrapper title="arXiv / RSS 订阅">
        <div className={styles.settingsStack}>
          {feedError ? (
            <div className={styles.notice}>订阅服务暂不可用：{feedError}</div>
          ) : null}
          <div className={styles.quickFeeds}>
            {QUICK_FEEDS.map(feed => (
              <Button
                key={feed.url}
                disabled={feedState === 'loading'}
                onClick={() => handleAddFeed(feed.url, feed.title)}
              >
                添加 {feed.title}
              </Button>
            ))}
            <Button disabled={feedState === 'loading'} onClick={loadFeeds}>
              刷新列表
            </Button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.label}>自定义订阅地址</span>
              <input
                className={styles.input}
                value={feedUrl}
                placeholder="https://example.com/feed.xml"
                onChange={event => setFeedUrl(event.target.value)}
              />
            </label>
            <Button
              className={styles.formActionButton}
              variant="primary"
              disabled={feedState === 'loading'}
              onClick={() => handleAddFeed(feedUrl)}
            >
              添加订阅
            </Button>
          </div>
        </div>
      </SettingWrapper>

      <SettingWrapper title="订阅新论文">
        {feeds.length ? (
          <div className={styles.feedRows}>
            {feeds.map(feed => (
              <div className={styles.feedRow} key={feed.id}>
                <div>
                  <div className={styles.feedTitle}>
                    {feed.title || feed.url}
                  </div>
                  <div className={styles.feedMeta}>
                    {feed.enabled ? '已启用' : '已停用'} · 上次同步：
                    {feed.lastSyncAt
                      ? new Date(feed.lastSyncAt).toLocaleString()
                      : '尚未同步'}
                    {feed.lastError ? ` · 错误：${feed.lastError}` : ''}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Button onClick={() => handleToggleFeed(feed)}>
                    {feed.enabled ? '停用' : '启用'}
                  </Button>
                  <Button onClick={() => handleRefreshFeed(feed.id)}>
                    立即刷新
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            暂无订阅源。可以先添加 arXiv cs.CV、cs.RO 或自定义 RSS。
          </div>
        )}
        {feedItems.length ? (
          <div className={styles.feedRows}>
            {feedItems.slice(0, 12).map(item => (
              <div className={styles.feedRow} key={item.id}>
                <div>
                  <div className={styles.feedTitle}>{item.title}</div>
                  <div className={styles.feedMeta}>
                    {item.authors?.join('; ') || '作者不详'}
                    {item.publishedAt
                      ? ` · ${new Date(item.publishedAt).getFullYear()}`
                      : ''}
                    {item.arxivId ? ` · arXiv ${item.arxivId}` : ''}
                  </div>
                </div>
                <Button onClick={() => handleImportFeedItem(item)}>
                  导入论文页
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </SettingWrapper>

      <SettingWrapper title="当前论文">
        <div className={styles.settingsSummary}>
          已收录 {papers.length}{' '}
          篇论文。浏览和阅读状态管理请回到侧边栏的论文库页面。
          {papers.length ? (
            <Button
              variant="secondary"
              onClick={() => openDoc(papers[0].docId)}
            >
              打开最近论文
            </Button>
          ) : null}
        </div>
      </SettingWrapper>
    </>
  );
};
