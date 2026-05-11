import { EmbedIframeConfigExtension } from '@blocksuite/affine-shared/services';

const JUPYTERLITE_DEFAULT_WIDTH_IN_SURFACE = 1100;
const JUPYTERLITE_DEFAULT_HEIGHT_IN_SURFACE = 720;
const JUPYTERLITE_DEFAULT_HEIGHT_IN_NOTE = 720;
const JUPYTERLITE_DEFAULT_WIDTH_PERCENT = 100;

export const JUPYTERLITE_NOTEBOOK_URL =
  '/jupyterlite/lab/index.html?path=affine-notebook.ipynb';
export const JUPYTERLITE_DEFAULT_NOTEBOOK_TITLE = 'Jupyter Notebook';

export function createDefaultNotebookJson() {
  return JSON.stringify(
    {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: [
            '# Jupyter Notebook\n',
            '\n',
            '这个 Notebook 由 AFFiNE JupyterLite 块创建。Python 在浏览器本地运行。',
          ],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            'import numpy as np\n',
            'import pandas as pd\n',
            'import matplotlib.pyplot as plt\n',
            '\n',
            'x = np.arange(1, 6)\n',
            'y = x ** 2\n',
            'plt.plot(x, y, marker=\"o\")\n',
            'plt.title(\"AFFiNE JupyterLite 示例\")\n',
            'plt.show()',
          ],
        },
      ],
      metadata: {
        kernelspec: {
          display_name: 'Python (Pyodide)',
          language: 'python',
          name: 'python',
        },
        language_info: {
          codemirror_mode: {
            name: 'ipython',
            version: 3,
          },
          file_extension: '.py',
          mimetype: 'text/x-python',
          name: 'python',
          nbconvert_exporter: 'python',
          pygments_lexer: 'ipython3',
          version: '3',
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    2
  );
}

export function getJupyterLiteNotebookUrl() {
  if (typeof window === 'undefined') {
    return JUPYTERLITE_NOTEBOOK_URL;
  }
  return new URL(JUPYTERLITE_NOTEBOOK_URL, window.location.origin).toString();
}

export function createJupyterLiteBlockProps() {
  const url = getJupyterLiteNotebookUrl();
  return {
    url,
    iframeUrl: url,
    title: JUPYTERLITE_DEFAULT_NOTEBOOK_TITLE,
    description: '浏览器本地运行的 Python Notebook，可导出 .ipynb 快照。',
    notebookJson: createDefaultNotebookJson(),
    lastSyncedAt: Date.now(),
    sourceMode: 'ipynb' as const,
    syncStatus: 'idle' as const,
    recentOutputsSummary: null,
  };
}

export function isJupyterLiteUrl(url: string) {
  try {
    const parsed = new URL(
      url,
      typeof window === 'undefined' ? 'http://localhost' : window.location.href
    );
    const currentOrigin =
      typeof window === 'undefined' ? parsed.origin : window.location.origin;
    return (
      parsed.origin === currentOrigin &&
      parsed.pathname.startsWith('/jupyterlite/')
    );
  } catch {
    return false;
  }
}

export const jupyterLiteConfig = {
  name: 'jupyterlite',
  match: isJupyterLiteUrl,
  buildOEmbedUrl: (url: string) => (isJupyterLiteUrl(url) ? url : undefined),
  useOEmbedUrlDirectly: true,
  validateIframeUrl: (iframeUrl: string) => isJupyterLiteUrl(iframeUrl),
  options: {
    widthInSurface: JUPYTERLITE_DEFAULT_WIDTH_IN_SURFACE,
    heightInSurface: JUPYTERLITE_DEFAULT_HEIGHT_IN_SURFACE,
    heightInNote: JUPYTERLITE_DEFAULT_HEIGHT_IN_NOTE,
    widthPercent: JUPYTERLITE_DEFAULT_WIDTH_PERCENT,
    allow: 'clipboard-read; clipboard-write; fullscreen; cross-origin-isolated',
    allowFullscreen: true,
    credentialless: false,
    referrerpolicy: 'same-origin',
    sandbox:
      'allow-same-origin allow-scripts allow-forms allow-downloads allow-popups allow-modals',
    style: 'border: none; border-radius: 8px;',
  },
};

export const JupyterLiteEmbedConfig =
  EmbedIframeConfigExtension(jupyterLiteConfig);
