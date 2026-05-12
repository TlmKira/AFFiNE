export type NotebookCellType = 'markdown' | 'code';

export type NotebookOutput = {
  output_type?: string;
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
};

export type NotebookCell = {
  cell_type: NotebookCellType;
  execution_count?: number | null;
  id?: string;
  metadata?: Record<string, unknown>;
  outputs?: NotebookOutput[];
  source?: string | string[];
};

export type NotebookDocument = {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
};

export type NotebookRuntimeOutput = {
  executionCount?: number | null;
  outputs: NotebookOutput[];
  status: 'ok' | 'error';
};
