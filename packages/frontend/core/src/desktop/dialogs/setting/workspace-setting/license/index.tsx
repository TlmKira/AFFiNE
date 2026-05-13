import { Button } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
} from '@affine/component/setting-components';
import { ServerService, UserFeatureService } from '@affine/core/modules/cloud';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { WorkspaceQuotaService } from '@affine/core/modules/quota';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { FrameworkScope, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EnableCloudPanel } from '../preference/enable-cloud';
import * as styles from './styles.css';

type ServiceStatus = 'ok' | 'disabled' | 'warning' | 'error';

interface SelfhostStatus {
  server: {
    status: ServiceStatus;
    version: string;
    deploymentType: string;
    flavor: string;
    startedAt: string;
    uptimeSeconds: number;
    currentTime: string;
  };
  services: {
    postgres: StatusCheck;
    redis: StatusCheck;
    notebook: StatusCheck;
    ai: StatusCheck;
    storage: StatusCheck & {
      provider?: string;
      writable?: boolean;
      disk?: {
        total: number;
        free: number;
        available: number;
      } | null;
    };
  };
  resources: {
    processMemory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    systemMemory: {
      total: number;
      free: number;
    };
    cpu: {
      cores: number;
      loadAverage: number[];
    };
  };
}

interface StatusCheck {
  status: ServiceStatus;
  message?: string;
}

export const WorkspaceSettingLicense = ({
  onCloseSetting,
}: {
  onCloseSetting: () => void;
}) => {
  const workspace = useService(WorkspaceService).workspace;
  const t = useI18n();

  if (workspace === null) {
    return null;
  }

  return (
    <FrameworkScope scope={workspace.scope}>
      <SettingHeader
        title={t['com.affine.settings.workspace.license']()}
        subtitle={t['com.affine.settings.workspace.license.description']()}
      />
      <AdminEntryCard />
      {workspace.flavour === 'local' ? (
        <EnableCloudPanel onCloseSetting={onCloseSetting} />
      ) : (
        <>
          <ServerStatusCard />
          <PrivateDeploymentCard />
        </>
      )}
    </FrameworkScope>
  );
};

const AdminEntryCard = () => {
  const t = useI18n();
  const serverService = useService(ServerService);
  const userFeatureService = useService(UserFeatureService);
  const isAdmin = useLiveData(userFeatureService.userFeature.isAdmin$);

  useEffect(() => {
    userFeatureService.userFeature.revalidate();
  }, [userFeatureService]);

  const openAdmin = useCallback(
    (path: string) => {
      window.open(`${serverService.server.baseUrl}${path}`, '_blank');
    },
    [serverService.server.baseUrl]
  );

  if (!isAdmin) return null;

  return (
    <div className={styles.sectionCard}>
      <div>
        <h3 className={styles.cardTitle}>
          {t['com.affine.settings.workspace.license.admin.title']()}
        </h3>
        <p className={styles.cardDescription}>
          {t['com.affine.settings.workspace.license.admin.description']()}
        </p>
      </div>
      <div className={styles.adminActions}>
        <Button onClick={() => openAdmin('/admin')}>
          {t['com.affine.settings.workspace.license.admin.open']()}
        </Button>
        <Button variant="secondary" onClick={() => openAdmin('/admin/ai')}>
          {t['com.affine.settings.workspace.license.admin.ai']()}
        </Button>
        <Button
          variant="secondary"
          onClick={() => openAdmin('/admin/accounts')}
        >
          {t['com.affine.settings.workspace.license.admin.accounts']()}
        </Button>
        <Button variant="secondary" onClick={() => openAdmin('/admin/queue')}>
          {t['com.affine.settings.workspace.license.admin.queue']()}
        </Button>
        <Button
          variant="secondary"
          onClick={() => openAdmin('/admin/settings#config-module-copilot')}
        >
          {t['com.affine.settings.workspace.license.admin.config']()}
        </Button>
      </div>
    </div>
  );
};

const ServerStatusCard = () => {
  const t = useI18n();
  const [status, setStatus] = useState<SelfhostStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/self-host/status', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? t[
                'com.affine.settings.workspace.license.server-status.forbidden'
              ]()
            : t['com.affine.settings.workspace.license.server-status.failed']()
        );
      }

      setStatus((await response.json()) as SelfhostStatus);
    } catch (err) {
      setStatus(null);
      setError(
        err instanceof Error
          ? err.message
          : t['com.affine.settings.workspace.license.server-status.failed']()
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadStatus().catch(console.error);
  }, [loadStatus]);

  return (
    <div className={styles.sectionCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>
            {t['com.affine.settings.workspace.license.server-status.title']()}
          </h3>
          <p className={styles.cardDescription}>
            {t[
              'com.affine.settings.workspace.license.server-status.description'
            ]()}
          </p>
        </div>
        <Button onClick={loadStatus} loading={loading} disabled={loading}>
          {t['com.affine.settings.workspace.license.server-status.refresh']()}
        </Button>
      </div>
      {error ? (
        <StatusGrid
          items={[
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.overall'
                ](),
              status: 'error',
              value: error,
            },
          ]}
        />
      ) : status ? (
        <StatusGrid
          items={[
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.backend'
                ](),
              status: status.server.status,
              value: `${status.server.version} · ${status.server.flavor}`,
            },
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.postgres'
                ](),
              ...toStatusView(status.services.postgres, t),
            },
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.redis'
                ](),
              ...toStatusView(status.services.redis, t),
            },
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.notebook'
                ](),
              ...toStatusView(status.services.notebook, t),
            },
            {
              label:
                t['com.affine.settings.workspace.license.server-status.ai'](),
              ...toStatusView(status.services.ai, t),
            },
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.storage'
                ](),
              status: status.services.storage.status,
              value: formatStorage(status.services.storage, t),
            },
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.memory'
                ](),
              status: 'ok',
              value: `${formatBytes(
                status.resources.systemMemory.total -
                  status.resources.systemMemory.free
              )} / ${formatBytes(status.resources.systemMemory.total)}`,
            },
            {
              label:
                t['com.affine.settings.workspace.license.server-status.cpu'](),
              status: 'ok',
              value: `${status.resources.cpu.cores} cores · ${status.resources.cpu.loadAverage
                .slice(0, 3)
                .map(value => value.toFixed(2))
                .join(' / ')}`,
            },
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.uptime'
                ](),
              status: 'ok',
              value: formatUptime(status.server.uptimeSeconds),
            },
            {
              label:
                t['com.affine.settings.workspace.license.server-status.time'](),
              status: 'ok',
              value: new Date(status.server.currentTime).toLocaleString(),
            },
          ]}
        />
      ) : (
        <StatusGrid
          items={[
            {
              label:
                t[
                  'com.affine.settings.workspace.license.server-status.overall'
                ](),
              status: 'loading',
              value:
                t[
                  'com.affine.settings.workspace.license.server-status.checking'
                ](),
            },
          ]}
        />
      )}
    </div>
  );
};

const PrivateDeploymentCard = () => {
  const t = useI18n();
  const workspaceQuotaService = useService(WorkspaceQuotaService);
  const permission = useService(WorkspacePermissionService).permission;
  const workspaceQuota = useLiveData(workspaceQuotaService.quota.quota$);
  const isTeam = useLiveData(permission.isTeam$);

  useEffect(() => {
    permission.revalidate();
    workspaceQuotaService.quota.revalidate();
  }, [permission, workspaceQuotaService]);

  const rows = useMemo(
    () => [
      {
        name: t[
          'com.affine.settings.workspace.license.private-deployment.workspace'
        ](),
        desc: isTeam
          ? t['com.affine.settings.workspace.license.private-deployment.team']()
          : t[
              'com.affine.settings.workspace.license.private-deployment.self-host'
            ](),
      },
      {
        name: t[
          'com.affine.settings.workspace.license.private-deployment.members'
        ](),
        desc: `${workspaceQuota?.memberCount ?? '-'} / ${
          workspaceQuota?.memberLimit ?? '-'
        }`,
      },
      {
        name: t[
          'com.affine.settings.workspace.license.private-deployment.services'
        ](),
        desc: t[
          'com.affine.settings.workspace.license.private-deployment.services.description'
        ](),
      },
    ],
    [isTeam, t, workspaceQuota]
  );

  return (
    <div className={styles.sectionCard}>
      <div>
        <h3 className={styles.cardTitle}>
          {t[
            'com.affine.settings.workspace.license.private-deployment.title'
          ]()}
        </h3>
        <p className={styles.cardDescription}>
          {t[
            'com.affine.settings.workspace.license.private-deployment.description'
          ]()}
        </p>
      </div>
      {rows.map(row => (
        <SettingRow
          key={row.name}
          spreadCol={false}
          name={row.name}
          desc={row.desc}
        />
      ))}
    </div>
  );
};

const StatusGrid = ({
  items,
}: {
  items: {
    label: string;
    status: ServiceStatus | 'loading';
    value: string;
  }[];
}) => {
  return (
    <div className={styles.statusGrid}>
      {items.map(item => (
        <div className={styles.statusItem} key={item.label}>
          <div className={styles.statusLabel}>{item.label}</div>
          <div className={styles.statusValue}>
            <span className={styles.statusDot} data-status={item.status} />
            <span className={styles.statusText} title={item.value}>
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const toStatusView = (check: StatusCheck, t: ReturnType<typeof useI18n>) => {
  return {
    status: check.status,
    value:
      t[
        `com.affine.settings.workspace.license.server-status.${check.status}`
      ](),
  };
};

const formatStorage = (
  storage: SelfhostStatus['services']['storage'],
  t: ReturnType<typeof useI18n>
) => {
  if (storage.message) {
    return t[
      `com.affine.settings.workspace.license.server-status.${storage.status}`
    ]();
  }

  if (storage.disk) {
    return `${storage.provider ?? 'fs'} · ${formatBytes(
      storage.disk.available
    )} ${t[
      'com.affine.settings.workspace.license.server-status.storage.available'
    ]()}`;
  }

  return `${storage.provider ?? '-'} · ${
    storage.writable
      ? t['com.affine.settings.workspace.license.server-status.ok']()
      : t['com.affine.settings.workspace.license.server-status.error']()
  }`;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};
