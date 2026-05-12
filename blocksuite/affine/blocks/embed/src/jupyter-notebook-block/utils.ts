import { createDefaultJupyterNotebookJson } from '@blocksuite/affine-model';

import type { NotebookCell, NotebookDocument } from './types.js';

export function sourceToString(source: unknown): string {
  if (Array.isArray(source)) {
    return source.join('');
  }
  return typeof source === 'string' ? source : '';
}

export function createCellId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `cell-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeNotebook(notebookJson?: string): NotebookDocument {
  try {
    const parsed = JSON.parse(
      notebookJson || createDefaultJupyterNotebookJson()
    ) as Partial<NotebookDocument>;
    return {
      cells: Array.isArray(parsed.cells) ? parsed.cells : [],
      metadata: parsed.metadata ?? {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          pygments_lexer: 'ipython3',
        },
      },
      nbformat: parsed.nbformat ?? 4,
      nbformat_minor: parsed.nbformat_minor ?? 5,
    };
  } catch {
    return normalizeNotebook(createDefaultJupyterNotebookJson());
  }
}

export function serializeNotebook(notebook: NotebookDocument) {
  return JSON.stringify(
    {
      ...notebook,
      cells: notebook.cells.map(cell => ({
        ...cell,
        id: cell.id ?? createCellId(),
        metadata: cell.metadata ?? {},
        outputs: cell.cell_type === 'code' ? (cell.outputs ?? []) : undefined,
        execution_count:
          cell.cell_type === 'code'
            ? (cell.execution_count ?? null)
            : undefined,
      })),
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    2
  );
}

export function createNotebookCell(type: 'markdown' | 'code'): NotebookCell {
  return {
    cell_type: type,
    execution_count: type === 'code' ? null : undefined,
    id: createCellId(),
    metadata: {},
    outputs: type === 'code' ? [] : undefined,
    source:
      type === 'code' ? '# 在这里编写 Python 代码' : '在这里写 Markdown 笔记',
  };
}
