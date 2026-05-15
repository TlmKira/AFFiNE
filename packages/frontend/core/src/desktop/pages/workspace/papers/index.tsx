import { Button } from '@affine/component';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './index.css';
import { PaperShelf, usePaperLibraryCore } from './library';
import type { CitationMetadata, CitationTranslationCandidate } from './utils';

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

function isCitationTextFile(file: File) {
  return (
    /\.(bib|ris|enw|nbib|txt|json|csl)$/i.test(file.name) ||
    /^text\//i.test(file.type) ||
    file.type === 'application/json'
  );
}

const PapersPage = () => {
  const workspaceDialogService = useService(WorkspaceDialogService);
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
          message: result.docId ? '已添加到论文书架' : '该论文可能已存在',
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

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
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
              .catch(error => {
                const id = makeQueueId();
                setImportQueue(items => [
                  {
                    id,
                    label: file.name,
                    status: 'failed',
                    message:
                      error instanceof Error ? error.message : String(error),
                  },
                  ...items,
                ]);
              });
          } else {
            const id = makeQueueId();
            setImportQueue(items => [
              {
                id,
                label: file.name,
                status: 'failed',
                message:
                  '暂时只支持直接拖入 PDF、BibTeX、RIS、NBIB、CSL JSON 或文本文件',
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

  const handleImportCandidate = useCallback(
    (candidate: CitationTranslationCandidate, queueId: string) => {
      const metadata: CitationMetadata = candidate.metadata ?? {
        title: candidate.title,
        url: candidate.url,
        source: 'Zotero Translator',
      };
      const docId = importPaperFromMetadata(metadata, 'manual');
      updateQueueItem(queueId, {
        status: docId ? 'done' : 'failed',
        message: docId ? `已导入：${candidate.title}` : '该论文可能已存在',
      });
    },
    [importPaperFromMetadata, updateQueueItem]
  );

  const handleImportAllCandidates = useCallback(
    (candidates: CitationTranslationCandidate[], queueId: string) => {
      let imported = 0;
      for (const candidate of candidates) {
        const metadata: CitationMetadata = candidate.metadata ?? {
          title: candidate.title,
          url: candidate.url,
          source: 'Zotero Translator',
        };
        if (importPaperFromMetadata(metadata, 'manual')) {
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

  return (
    <>
      <ViewTitle title="论文库" />
      <ViewIcon icon="paper" />
      <ViewHeader>
        <div className={styles.header}>
          <div className={styles.headerTitle}>论文库</div>
          <div className={styles.headerStats}>
            <span>{papers.length} 篇论文</span>
          </div>
        </div>
      </ViewHeader>
      <ViewBody>
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
                <div className={styles.pageDropTitle}>拖入论文到书架</div>
                <div className={styles.pageDropHint}>
                  支持 PDF、论文链接、DOI、arXiv、BibTeX、RIS 和普通文本线索
                </div>
              </div>
            </div>
          ) : null}
          <div className={styles.shelfContent}>
            <div className={styles.shelfQuickActions}>
              <Button variant="primary" onClick={handleAddFromClipboard}>
                添加论文
              </Button>
              <Button
                onClick={() =>
                  workspaceDialogService.open('setting', {
                    activeTab: 'papers',
                  })
                }
              >
                论文库设置
              </Button>
            </div>
            {importQueue.length ? (
              <section className={styles.importQueue}>
                <div className={styles.importQueueTitle}>导入队列</div>
                {importQueue.map(item => (
                  <div className={styles.importQueueItem} key={item.id}>
                    <div className={styles.importQueueMain}>
                      <div className={styles.importQueueLabel}>
                        {item.label}
                      </div>
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
                <Button
                  variant="primary"
                  onClick={() =>
                    workspaceDialogService.open('setting', {
                      activeTab: 'papers',
                    })
                  }
                >
                  去设置中添加论文
                </Button>
              }
            />
          </div>
        </main>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <PapersPage />;
};
