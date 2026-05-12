import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Config } from '../../base';

type RuntimeWebSocket = {
  addEventListener(
    event: 'open' | 'message' | 'error' | 'close',
    listener: (event: any) => void
  ): void;
  close(): void;
  send(data: string): void;
};

type RuntimeWebSocketConstructor = new (url: string) => RuntimeWebSocket;

type NotebookSession = {
  blockId: string;
  docId: string;
  idleTimer?: NodeJS.Timeout;
  kernelId: string;
  sessionId: string;
  userId: string;
  workspaceId: string;
};

type NotebookOutput = {
  output_type?: string;
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
};

type ExecuteResult = {
  executionCount?: number | null;
  outputs: NotebookOutput[];
  status: 'ok' | 'error';
};

function createMessageId() {
  return `affine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function outputSize(output: NotebookOutput) {
  return Buffer.byteLength(JSON.stringify(output), 'utf8');
}

@Injectable()
export class NotebookRuntimeService implements OnApplicationShutdown {
  private readonly logger = new Logger(NotebookRuntimeService.name);
  private readonly sessions = new Map<string, NotebookSession>();

  constructor(private readonly config: Config) {}

  async listKernelSpecs() {
    this.assertEnabled();
    return await this.gatewayFetch('/api/kernelspecs');
  }

  async createSession(input: {
    blockId: string;
    docId: string;
    userId: string;
    workspaceId: string;
  }) {
    this.assertEnabled();

    const existing = this.findSession(input);
    if (existing) {
      this.touch(existing);
      return this.toSessionPayload(existing);
    }

    if (this.sessions.size >= this.config.notebook.maxConcurrentKernels) {
      throw new ServiceUnavailableException(
        'Notebook 运行服务已达到并发 Kernel 数量上限。'
      );
    }

    const kernel = (await this.gatewayFetch('/api/kernels', {
      method: 'POST',
      body: JSON.stringify({ name: 'python3' }),
    })) as { id?: string };

    if (!kernel.id) {
      throw new ServiceUnavailableException(
        'Notebook 运行服务没有返回 Kernel ID。'
      );
    }

    const session: NotebookSession = {
      ...input,
      kernelId: kernel.id,
      sessionId: createMessageId(),
    };
    this.sessions.set(session.sessionId, session);
    this.touch(session);
    return this.toSessionPayload(session);
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = this.getOwnedSession(sessionId, userId);
    await this.shutdownKernel(session);
    return { ok: true };
  }

  async interrupt(sessionId: string, userId: string) {
    const session = this.getOwnedSession(sessionId, userId);
    await this.gatewayFetch(`/api/kernels/${session.kernelId}/interrupt`, {
      method: 'POST',
    });
    this.touch(session);
    return { ok: true };
  }

  async restart(sessionId: string, userId: string) {
    const session = this.getOwnedSession(sessionId, userId);
    const kernel = (await this.gatewayFetch(
      `/api/kernels/${session.kernelId}/restart`,
      { method: 'POST' }
    )) as { id?: string };
    session.kernelId = kernel.id || session.kernelId;
    session.sessionId = createMessageId();
    this.sessions.delete(sessionId);
    this.sessions.set(session.sessionId, session);
    this.touch(session);
    return this.toSessionPayload(session);
  }

  async execute(
    sessionId: string,
    userId: string,
    code: string
  ): Promise<ExecuteResult> {
    const session = this.getOwnedSession(sessionId, userId);
    this.touch(session);
    return await this.executeOnKernel(session, code);
  }

  async onApplicationShutdown() {
    await Promise.allSettled(
      [...this.sessions.values()].map(session => this.shutdownKernel(session))
    );
  }

  private assertEnabled() {
    if (!this.config.notebook.enabled) {
      throw new ServiceUnavailableException(
        'Notebook 运行服务未启用。请设置 AFFINE_NOTEBOOK_ENABLED=true，并配置 AFFINE_NOTEBOOK_GATEWAY_URL。'
      );
    }
  }

  private findSession(input: {
    blockId: string;
    docId: string;
    userId: string;
    workspaceId: string;
  }) {
    return [...this.sessions.values()].find(
      session =>
        session.blockId === input.blockId &&
        session.docId === input.docId &&
        session.userId === input.userId &&
        session.workspaceId === input.workspaceId
    );
  }

  private getOwnedSession(sessionId: string, userId: string) {
    this.assertEnabled();
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new ServiceUnavailableException(
        'Notebook 会话不可用，请重新运行当前代码块。'
      );
    }
    return session;
  }

  private touch(session: NotebookSession) {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    session.idleTimer = setTimeout(() => {
      this.shutdownKernel(session).catch(error => {
        this.logger.warn(
          `Failed to shut down idle notebook kernel ${session.kernelId}: ${error}`
        );
      });
    }, this.config.notebook.idleTimeoutSeconds * 1000);
  }

  private async shutdownKernel(session: NotebookSession) {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    this.sessions.delete(session.sessionId);
    try {
      await this.gatewayFetch(`/api/kernels/${session.kernelId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete notebook kernel ${session.kernelId}: ${error}`
      );
    }
  }

  private toSessionPayload(session: NotebookSession) {
    return {
      kernelId: session.kernelId,
      sessionId: session.sessionId,
      status: 'connected',
    };
  }

  private gatewayUrl(path: string) {
    const url = new URL(path, this.config.notebook.gatewayUrl);
    const token = this.config.notebook.gatewayToken;
    if (token) {
      url.searchParams.set('token', token);
    }
    return url;
  }

  private gatewayWsUrl(session: NotebookSession) {
    const url = this.gatewayUrl(`/api/kernels/${session.kernelId}/channels`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('session_id', session.sessionId);
    return url.toString();
  }

  private gatewayHeaders() {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (this.config.notebook.gatewayToken) {
      headers.authorization = `token ${this.config.notebook.gatewayToken}`;
    }
    return headers;
  }

  private async gatewayFetch(path: string, init: RequestInit = {}) {
    const response = await fetch(this.gatewayUrl(path), {
      ...init,
      headers: {
        ...this.gatewayHeaders(),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload?.message ||
          payload?.reason ||
          `Notebook 运行服务请求失败：${response.status}。`
      );
    }
    return payload;
  }

  private websocketCtor(): RuntimeWebSocketConstructor {
    const ctor = (
      globalThis as typeof globalThis & {
        WebSocket?: RuntimeWebSocketConstructor;
      }
    ).WebSocket;
    if (!ctor) {
      throw new ServiceUnavailableException(
        '当前 Node.js 运行时不支持 WebSocket，请使用 Node 22 或更新版本。'
      );
    }
    return ctor;
  }

  private executeOnKernel(session: NotebookSession, code: string) {
    return new Promise<ExecuteResult>((resolve, reject) => {
      const WebSocketCtor = this.websocketCtor();
      const ws = new WebSocketCtor(this.gatewayWsUrl(session));
      const msgId = createMessageId();
      const outputs: NotebookOutput[] = [];
      let totalOutputBytes = 0;
      let executionCount: number | null = null;
      let completed = false;
      let truncated = false;

      const timeout = setTimeout(() => {
        finish(new Error('Notebook 代码块执行超时。'));
      }, 120_000);

      const pushOutput = (output: NotebookOutput) => {
        const nextSize = outputSize(output);
        if (totalOutputBytes + nextSize > this.config.notebook.maxOutputBytes) {
          if (!truncated) {
            outputs.push({
              output_type: 'stream',
              name: 'stderr',
              text: '\n[输出过大，已按服务端限制截断]\n',
            });
            truncated = true;
          }
          return;
        }
        totalOutputBytes += nextSize;
        outputs.push(output);
      };

      const finish = (error?: Error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        try {
          ws.close();
        } catch {}
        if (error) {
          reject(error);
        } else {
          resolve({
            executionCount,
            outputs,
            status: outputs.some(output => output.output_type === 'error')
              ? 'error'
              : 'ok',
          });
        }
      };

      ws.addEventListener('open', () => {
        ws.send(
          JSON.stringify({
            channel: 'shell',
            content: {
              allow_stdin: false,
              code,
              silent: false,
              stop_on_error: true,
              store_history: true,
              user_expressions: {},
            },
            header: {
              date: new Date().toISOString(),
              msg_id: msgId,
              msg_type: 'execute_request',
              session: session.sessionId,
              username: session.userId,
              version: '5.3',
            },
            metadata: {},
            parent_header: {},
          })
        );
      });

      ws.addEventListener('error', event => {
        finish(new Error(`Notebook WebSocket 连接失败：${String(event)}`));
      });

      ws.addEventListener('message', event => {
        const raw = typeof event.data === 'string' ? event.data : '';
        if (!raw) return;
        const message = JSON.parse(raw);
        if (message.parent_header?.msg_id !== msgId) return;
        const msgType = message.header?.msg_type;
        const content = message.content ?? {};

        if (msgType === 'execute_input') {
          executionCount = content.execution_count ?? executionCount;
        } else if (msgType === 'stream') {
          pushOutput({
            output_type: 'stream',
            name: content.name,
            text: content.text,
          });
        } else if (msgType === 'execute_result' || msgType === 'display_data') {
          pushOutput({
            output_type: msgType,
            data: content.data,
          });
        } else if (msgType === 'error') {
          pushOutput({
            output_type: 'error',
            ename: content.ename,
            evalue: content.evalue,
            traceback: content.traceback,
          });
        } else if (msgType === 'status' && content.execution_state === 'idle') {
          finish();
        }
      });
    });
  }
}
