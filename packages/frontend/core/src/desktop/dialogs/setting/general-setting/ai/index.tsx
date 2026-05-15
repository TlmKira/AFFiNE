import { Button, notify, Switch } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import {
  GraphQLService,
  ServerService,
  UserFeatureService,
} from '@affine/core/modules/cloud';
import { UserFriendlyError } from '@affine/error';
import { appConfigQuery, updateAppConfigMutation } from '@affine/graphql';
import { useI18n, type I18nInstance } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { get } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';

import * as styles from './style.css';

type ProviderId = 'openai' | 'gemini' | 'anthropic';

type ProviderDraft = {
  apiKey: string;
  baseURL?: string;
};

type AppConfig = Record<string, unknown>;
type ProviderConfig = Record<string, unknown> & {
  apiKey?: unknown;
  baseURL?: unknown;
};
type AppConfigUpdate = {
  module: string;
  key: string;
  value: unknown;
};
type GraphQLAppConfigUpdateInput = Omit<AppConfigUpdate, 'value'> & {
  value: Record<string, string>;
};

const PROVIDERS: Array<{
  id: ProviderId;
  nameKey: string;
  descriptionKey: string;
  supportsBaseURL?: boolean;
}> = [
  {
    id: 'openai',
    nameKey: 'provider.openai.name',
    descriptionKey: 'provider.openai.description',
    supportsBaseURL: true,
  },
  {
    id: 'gemini',
    nameKey: 'provider.gemini.name',
    descriptionKey: 'provider.gemini.description',
  },
  {
    id: 'anthropic',
    nameKey: 'provider.anthropic.name',
    descriptionKey: 'provider.anthropic.description',
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getProviderConfig = (
  appConfig: AppConfig | null,
  provider: ProviderId
): ProviderConfig => {
  const config = get(appConfig, `copilot.providers.${provider}`);
  return isRecord(config) ? config : {};
};

const getProviderConfigured = (
  appConfig: AppConfig | null,
  provider: ProviderId
) => {
  const apiKey = getProviderConfig(appConfig, provider).apiKey;
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
};

const getEnabled = (appConfig: AppConfig | null) =>
  Boolean(get(appConfig, 'copilot.enabled'));

const hasAnyProviderKey = (
  appConfig: AppConfig | null,
  drafts: Record<ProviderId, ProviderDraft>
) =>
  PROVIDERS.some(
    provider =>
      getProviderConfigured(appConfig, provider.id) ||
      drafts[provider.id].apiKey.trim().length > 0
  );

const initialDrafts = (appConfig: AppConfig | null) =>
  PROVIDERS.reduce(
    (drafts, provider) => {
      const config = getProviderConfig(appConfig, provider.id);
      drafts[provider.id] = {
        apiKey: '',
        baseURL:
          provider.supportsBaseURL && typeof config.baseURL === 'string'
            ? config.baseURL
            : '',
      };
      return drafts;
    },
    {} as Record<ProviderId, ProviderDraft>
  );

export const canShowAISettings = (isAdmin: boolean | null | undefined) =>
  isAdmin === true || BUILD_CONFIG.debug;

const aiT = (t: I18nInstance, key: string, options?: Record<string, unknown>) =>
  t.t(`com.affine.settings.ai.${key}`, options);

function validateBaseURL(baseURL: string) {
  const value = baseURL.trim();
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const AISettings = () => {
  const t = useI18n();
  const gqlService = useService(GraphQLService);
  const serverService = useService(ServerService);
  const userFeatureService = useService(UserFeatureService);
  const isAdmin = useLiveData(userFeatureService.userFeature.isAdmin$);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [drafts, setDrafts] = useState<Record<ProviderId, ProviderDraft>>(() =>
    initialDrafts(null)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canShowSettings = canShowAISettings(isAdmin);
  const isLocalPreview = isAdmin !== true && BUILD_CONFIG.debug;

  useEffect(() => {
    userFeatureService.userFeature.revalidate();
  }, [userFeatureService]);

  const resetDraft = useCallback((config: AppConfig | null) => {
    setAppConfig(config);
    setEnabled(getEnabled(config));
    setDrafts(initialDrafts(config));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await gqlService.gql({ query: appConfigQuery });
      resetDraft((response.appConfig ?? {}) as AppConfig);
    } catch (err) {
      const friendlyError = UserFriendlyError.fromAny(err);
      setError(friendlyError.message);
    } finally {
      setLoading(false);
    }
  }, [gqlService, resetDraft]);

  useEffect(() => {
    if (isAdmin === true) {
      load().catch(console.error);
    } else if (isLocalPreview) {
      resetDraft({});
      setLoading(false);
      setError(null);
    }
  }, [isAdmin, isLocalPreview, load, resetDraft]);

  const dirty = useMemo(() => {
    if (!appConfig) return false;
    if (enabled !== getEnabled(appConfig)) return true;
    return PROVIDERS.some(provider => {
      const draft = drafts[provider.id];
      if (draft.apiKey.trim()) return true;
      if (!provider.supportsBaseURL) return false;
      const currentBaseURL = getProviderConfig(appConfig, provider.id).baseURL;
      return (draft.baseURL ?? '') !== (currentBaseURL ?? '');
    });
  }, [appConfig, drafts, enabled]);

  const updateDraft = useCallback(
    (provider: ProviderId, patch: Partial<ProviderDraft>) => {
      setDrafts(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          ...patch,
        },
      }));
    },
    []
  );

  const save = useCallback(async () => {
    if (!appConfig) return;

    const openAIBaseURL = drafts.openai.baseURL ?? '';
    if (!validateBaseURL(openAIBaseURL)) {
      notify.error({
        title: aiT(t, 'notify.invalid-base-url.title'),
        message: aiT(t, 'notify.invalid-base-url.message'),
      });
      return;
    }

    if (enabled && !hasAnyProviderKey(appConfig, drafts)) {
      notify.error({
        title: aiT(t, 'notify.provider-key-required.title'),
        message: aiT(t, 'notify.provider-key-required.message'),
      });
      return;
    }

    const updates: AppConfigUpdate[] = [];

    if (enabled !== getEnabled(appConfig)) {
      updates.push({
        module: 'copilot',
        key: 'enabled',
        value: enabled,
      });
    }

    for (const provider of PROVIDERS) {
      const draft = drafts[provider.id];
      const currentConfig = getProviderConfig(appConfig, provider.id);
      const nextConfig = { ...currentConfig };
      let changed = false;

      const apiKey = draft.apiKey.trim();
      if (apiKey) {
        nextConfig.apiKey = apiKey;
        changed = true;
      }

      if (provider.supportsBaseURL) {
        const baseURL = (draft.baseURL ?? '').trim();
        if (baseURL !== (currentConfig.baseURL ?? '')) {
          nextConfig.baseURL = baseURL;
          changed = true;
        }
      }

      if (changed) {
        updates.push({
          module: 'copilot',
          key: `providers.${provider.id}`,
          value: nextConfig,
        });
      }
    }

    if (!updates.length) {
      return;
    }

    setSaving(true);
    try {
      await gqlService.gql({
        query: updateAppConfigMutation,
        variables: {
          updates: updates as unknown as GraphQLAppConfigUpdateInput[],
        },
      });
      notify.success({
        title: aiT(t, 'notify.saved.title'),
        message: aiT(t, 'notify.saved.message'),
      });
      await load();
    } catch (err) {
      const friendlyError = UserFriendlyError.fromAny(err);
      notify.error({
        title: aiT(t, 'notify.save-failed.title'),
        message: friendlyError.message,
      });
    } finally {
      setSaving(false);
    }
  }, [appConfig, drafts, enabled, gqlService, load, t]);

  const openAdminAI = useCallback(() => {
    window.open(`${serverService.server.baseUrl}/admin/ai`, '_blank');
  }, [serverService.server.baseUrl]);

  if (!canShowSettings) {
    return null;
  }

  return (
    <>
      <SettingHeader title={aiT(t, 'title')} subtitle={aiT(t, 'subtitle')} />
      {isLocalPreview ? (
        <div className={styles.previewNotice}>{aiT(t, 'preview.notice')}</div>
      ) : null}
      <SettingWrapper title={aiT(t, 'global.title')}>
        {loading ? (
          <div className={styles.loading}>{aiT(t, 'loading')}</div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}
        <SettingRow
          name={aiT(t, 'global.enable.name')}
          desc={aiT(t, 'global.enable.description')}
        >
          <Switch checked={enabled} disabled={loading} onChange={setEnabled} />
        </SettingRow>
      </SettingWrapper>
      <SettingWrapper title={aiT(t, 'providers.title')}>
        <div className={styles.stack}>
          <div className={styles.panel} data-testid="ai-provider-panel">
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.title}>{aiT(t, 'providers.panel')}</div>
                <div className={styles.description}>
                  {aiT(t, 'providers.description')}
                </div>
              </div>
            </div>
            <div className={styles.providerRows}>
              {PROVIDERS.map(provider => {
                const configured = getProviderConfigured(
                  appConfig,
                  provider.id
                );
                const draft = drafts[provider.id];
                return (
                  <div className={styles.providerRow} key={provider.id}>
                    <div className={styles.providerMeta}>
                      <div className={styles.providerTitleLine}>
                        <div className={styles.providerName}>
                          {aiT(t, provider.nameKey)}
                        </div>
                        <div
                          className={
                            configured ? styles.configuredBadge : styles.badge
                          }
                        >
                          {configured
                            ? aiT(t, 'status.configured')
                            : aiT(t, 'status.not-configured')}
                        </div>
                      </div>
                      <div className={styles.description}>
                        {aiT(t, provider.descriptionKey)}
                      </div>
                    </div>
                    <div className={styles.form}>
                      <label className={styles.field}>
                        <span className={styles.label}>
                          {aiT(t, 'field.api-key')}
                        </span>
                        <input
                          className={styles.input}
                          type="password"
                          value={draft.apiKey}
                          disabled={loading || saving}
                          placeholder={
                            configured
                              ? aiT(t, 'placeholder.keep-current-key')
                              : aiT(t, 'placeholder.api-key')
                          }
                          onChange={event =>
                            updateDraft(provider.id, {
                              apiKey: event.currentTarget.value,
                            })
                          }
                        />
                      </label>
                      {provider.supportsBaseURL ? (
                        <label className={styles.field}>
                          <span className={styles.label}>
                            {aiT(t, 'field.base-url')}
                          </span>
                          <input
                            className={styles.input}
                            value={draft.baseURL ?? ''}
                            disabled={loading || saving}
                            placeholder="https://api.openai.com/v1"
                            onChange={event =>
                              updateDraft(provider.id, {
                                baseURL: event.currentTarget.value,
                              })
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={openAdminAI}>
              {aiT(t, 'action.open-admin')}
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || loading || saving}
              onClick={() => {
                save().catch(console.error);
              }}
            >
              {saving ? aiT(t, 'action.saving') : aiT(t, 'action.save')}
            </Button>
          </div>
        </div>
      </SettingWrapper>
    </>
  );
};
