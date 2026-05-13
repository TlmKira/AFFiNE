import { accessSync, constants, statfsSync, statSync } from 'node:fs';
import { cpus, freemem, homedir, loadavg, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { Config } from '../../base';
import { CacheRedis } from '../../base/redis';

const startedAt = new Date();

export type ServiceStatus = 'ok' | 'disabled' | 'warning' | 'error';

export interface StatusCheck {
  status: ServiceStatus;
  message?: string;
}

@Injectable()
export class SelfhostStatusService {
  constructor(
    private readonly config: Config,
    private readonly prisma: PrismaClient,
    private readonly redis: CacheRedis
  ) {}

  async getStatus() {
    const [postgres, redis, notebook, storage] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkNotebook(),
      this.checkStorage(),
    ]);

    return {
      server: {
        status: 'ok' as const,
        version: env.version,
        deploymentType: env.DEPLOYMENT_TYPE,
        flavor: env.FLAVOR,
        startedAt: startedAt.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        currentTime: new Date().toISOString(),
      },
      services: {
        postgres,
        redis,
        notebook,
        ai: this.checkAi(),
        storage,
      },
      resources: {
        processMemory: process.memoryUsage(),
        systemMemory: {
          total: totalmem(),
          free: freemem(),
        },
        cpu: {
          cores: cpus().length,
          loadAverage: loadavg(),
        },
      },
    };
  }

  private async checkPostgres(): Promise<StatusCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return {
        status: 'error',
        message: 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<StatusCheck> {
    try {
      await this.redis.ping();
      return { status: 'ok' };
    } catch {
      return {
        status: 'error',
        message: 'Redis connection failed',
      };
    }
  }

  private async checkNotebook(): Promise<StatusCheck> {
    const notebook = this.config.notebook;

    if (!notebook?.enabled) {
      return {
        status: 'disabled',
        message: 'Notebook runtime is disabled',
      };
    }

    try {
      const url = new URL('/api/kernelspecs', notebook.gatewayUrl);
      const headers: Record<string, string> = {};
      if (notebook.gatewayToken) {
        headers.authorization = `token ${notebook.gatewayToken}`;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return {
          status: 'error',
          message: 'Notebook gateway connection failed',
        };
      }

      return { status: 'ok' };
    } catch {
      return {
        status: 'error',
        message: 'Notebook gateway connection failed',
      };
    }
  }

  private checkAi(): StatusCheck {
    const copilot = this.config.copilot;

    if (!copilot?.enabled) {
      return {
        status: 'disabled',
        message: 'AI is disabled',
      };
    }

    const providers = copilot.providers;
    const hasProfile = providers.profiles.some(
      profile => profile.enabled !== false
    );
    const hasBuiltInKey = Boolean(
      providers.openai.apiKey ||
      providers.gemini.apiKey ||
      providers.anthropic.apiKey ||
      providers.fal.apiKey ||
      providers.cloudflareWorkersAi.apiToken
    );

    if (!hasProfile && !hasBuiltInKey) {
      return {
        status: 'warning',
        message: 'AI is enabled but model API keys are not configured',
      };
    }

    return { status: 'ok' };
  }

  private async checkStorage() {
    const storage = this.config.storages?.blob.storage;
    if (!storage) {
      return {
        status: 'disabled' as ServiceStatus,
        provider: undefined,
        writable: false,
        disk: null,
        message: 'Storage is not configured in this server flavor',
      };
    }

    const base = {
      status: 'ok' as ServiceStatus,
      provider: storage.provider,
      writable: true,
      disk: null as null | {
        total: number;
        free: number;
        available: number;
      },
      message: undefined as string | undefined,
    };

    if (storage.provider !== 'fs') {
      return base;
    }

    const path = this.resolveFsStoragePath(storage.config.path, storage.bucket);

    try {
      const stats = statSync(path, { throwIfNoEntry: false });
      if (!stats?.isDirectory()) {
        return {
          ...base,
          status: 'error' as ServiceStatus,
          writable: false,
          message: 'Local storage directory is missing or unavailable',
        };
      }

      accessSync(path, constants.R_OK | constants.W_OK);
      const disk = statfsSync(path);
      return {
        ...base,
        disk: {
          total: disk.blocks * disk.bsize,
          free: disk.bfree * disk.bsize,
          available: disk.bavail * disk.bsize,
        },
      };
    } catch {
      return {
        ...base,
        status: 'error' as ServiceStatus,
        writable: false,
        message: 'Local storage directory is not readable or writable',
      };
    }
  }

  private resolveFsStoragePath(path: string, bucket: string) {
    const root = path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
    return join(root || tmpdir(), bucket);
  }
}
