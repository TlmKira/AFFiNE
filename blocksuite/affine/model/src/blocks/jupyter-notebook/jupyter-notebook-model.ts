import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/store';

import type { BlockMeta } from '../../utils/types.js';

export type JupyterNotebookRuntimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'running'
  | 'error';

export type JupyterNotebookSyncStatus =
  | 'idle'
  | 'synced'
  | 'exported'
  | 'error';

export type JupyterNotebookBlockProps = {
  title: string;
  notebookJson: string;
  runtimeMode: 'self-hosted';
  runtimeStatus: JupyterNotebookRuntimeStatus;
  lastSavedAt?: number;
  lastExecutedAt?: number;
  lastSyncedAt?: number;
  syncStatus: JupyterNotebookSyncStatus;
} & BlockMeta;

export const createDefaultJupyterNotebookJson = () =>
  JSON.stringify(
    {
      cells: [
        {
          cell_type: 'code',
          execution_count: null,
          id: 'demo',
          metadata: {},
          outputs: [],
          source:
            'import numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2 * np.pi, 100)\nplt.plot(x, np.sin(x))\nplt.title(\"AFFiNE Notebook 示例\")\nplt.show()',
        },
      ],
      metadata: {
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
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    2
  );

export const JupyterNotebookBlockSchema = defineBlockSchema({
  flavour: 'affine:jupyter-notebook',
  props: (): JupyterNotebookBlockProps => ({
    title: 'Jupyter Notebook',
    notebookJson: createDefaultJupyterNotebookJson(),
    runtimeMode: 'self-hosted',
    runtimeStatus: 'idle',
    lastSavedAt: undefined,
    lastExecutedAt: undefined,
    lastSyncedAt: undefined,
    syncStatus: 'idle',
    'meta:createdAt': undefined,
    'meta:createdBy': undefined,
    'meta:updatedAt': undefined,
    'meta:updatedBy': undefined,
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'affine:note',
      'affine:paragraph',
      'affine:list',
      'affine:edgeless-text',
    ],
    children: [],
  },
  toModel: () => new JupyterNotebookBlockModel(),
});

export const JupyterNotebookBlockSchemaExtension = BlockSchemaExtension(
  JupyterNotebookBlockSchema
);

export class JupyterNotebookBlockModel extends BlockModel<JupyterNotebookBlockProps> {}
