import type { NotebookRuntimeOutput } from './types.js';

type NotebookSession = {
  kernelId: string;
  sessionId: string;
  status: string;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Notebook 运行服务请求失败：${response.status}`
    );
  }
  return payload as T;
}

export class NotebookRuntimeClient {
  constructor(
    private readonly workspaceId: string,
    private readonly docId: string,
    private readonly blockId: string
  ) {}

  private get basePath() {
    const workspaceId = encodeURIComponent(this.workspaceId);
    const blockId = encodeURIComponent(this.blockId);
    return `/api/workspaces/${workspaceId}/notebooks/${blockId}`;
  }

  async createSession(notebookJson: string): Promise<NotebookSession> {
    const response = await fetch(`${this.basePath}/sessions`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        docId: this.docId,
        notebookJson,
      }),
    });
    return readJsonResponse<NotebookSession>(response);
  }

  async deleteSession(sessionId: string) {
    const response = await fetch(
      `${this.basePath}/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
      }
    );
    return readJsonResponse<{ ok: boolean }>(response);
  }

  async interrupt(sessionId: string) {
    const response = await fetch(
      `${this.basePath}/sessions/${encodeURIComponent(sessionId)}/interrupt`,
      {
        method: 'POST',
        credentials: 'same-origin',
      }
    );
    return readJsonResponse<{ ok: boolean }>(response);
  }

  async restart(sessionId: string) {
    const response = await fetch(
      `${this.basePath}/sessions/${encodeURIComponent(sessionId)}/restart`,
      {
        method: 'POST',
        credentials: 'same-origin',
      }
    );
    return readJsonResponse<NotebookSession>(response);
  }

  async execute(
    sessionId: string,
    code: string,
    cellId?: string
  ): Promise<NotebookRuntimeOutput> {
    const response = await fetch(
      `${this.basePath}/sessions/${encodeURIComponent(sessionId)}/execute`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cellId, code }),
      }
    );
    return readJsonResponse<NotebookRuntimeOutput>(response);
  }
}
